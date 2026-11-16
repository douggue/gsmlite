// Fake Dhru Fusion supplier, for testing orders end to end without spending real credit.
//
//   node scripts/fake-supplier.mjs            → http://localhost:4010 (username "demo", API key "demo-key")
//
// In Admin → Suppliers add a supplier with that address, username and key, sync it, and link services 101–105.
// What each service does:
//   101  Delivers: "in process" on the first status check, then a result (an IMEI ending in 0 is refused as blacklisted)
//   102  Refuses every IMEI ("IMEI is blacklisted")
//   103  Stays "in process" (to test slow orders and the staff "check now" button)
//   104  Our account has no credit: the order can't be placed (the line must keep waiting, not be refunded)
//   105  Answers with a broken HTML page (the line becomes "unknown" and waits for staff)
import http from "node:http";

const SERVICES = {
  101: { name: "iPhone USA AT&T · clean", credit: "18.00", time: "1-3 Days" },
  102: { name: "Always refused (test)", credit: "1.00", time: "Instant" },
  103: { name: "Slow service (test)", credit: "5.00", time: "5-10 Days" },
  104: { name: "No credit (test)", credit: "9.00", time: "1-24 Hours" },
  105: { name: "Broken reply (test)", credit: "2.00", time: "Instant" },
};

/** Reads ID / IMEI / QNT from Dhru "parameters": base64 JSON, plain JSON, or the XML-ish <PARAMETERS> form. */
function readParams(raw) {
  if (!raw) return {};
  const tryJson = (s) => { try { const o = JSON.parse(s); return o && typeof o === "object" ? o : null; } catch { return null; } };
  const j = tryJson(raw) ?? tryJson(Buffer.from(raw, "base64").toString("utf8"));
  if (j) return Object.fromEntries(Object.entries(j).map(([k, v]) => [k.toUpperCase(), String(v)]));
  const out = {};
  for (const m of raw.matchAll(/<([A-Z_]+)>([^<]*)<\/\1>/gi)) out[m[1].toUpperCase()] = m[2];
  return out;
}

export function startFakeSupplier({ port = 4010, username = "demo", apiKey = "demo-key" } = {}) {
  const orders = new Map();
  const log = [];
  let next = 5000;
  const reply = (res, body, status = 200) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify({ ...body, apiversion: "6.1" }));
  };
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const f = new URLSearchParams(body);
      const action = f.get("action");
      const p = readParams(f.get("parameters"));
      log.push({ action, params: p });
      if (f.get("username") !== username || f.get("apiaccesskey") !== apiKey) return reply(res, { ERROR: [{ MESSAGE: "Authentication Failed" }] });
      if (action === "accountinfo") return reply(res, { SUCCESS: [{ message: "Your Accout Info", AccoutInfo: { credit: "$250.00", creditraw: "250", currency: "USD", mail: "demo@supplier.test" } }] });
      if (action === "imeiservicelist") {
        return reply(res, { SUCCESS: [{ MESSAGE: "IMEI Service List", LIST: { "Test group": { GROUPNAME: "Test group", GROUPTYPE: "IMEI", SERVICES: Object.fromEntries(Object.entries(SERVICES).map(([id, s]) => [id, { SERVICEID: Number(id), SERVICETYPE: "IMEI", SERVICENAME: s.name, CREDIT: s.credit, TIME: s.time, INFO: "Fake supplier for tests" }])) } } }] });
      }
      if (action === "fileservicelist" || action === "serverservicelist") return reply(res, { ERROR: [{ MESSAGE: "Invalid Action" }] });
      if (action === "placeimeiorder") {
        const id = String(p.ID ?? "");
        if (!SERVICES[id]) return reply(res, { ERROR: [{ MESSAGE: "Invalid Service ID" }] });
        if (id === "104") return reply(res, { ERROR: [{ MESSAGE: "Not enough credits" }] });
        if (id === "105") { res.writeHead(502, { "content-type": "text/html" }); return res.end("<html><body>Bad gateway</body></html>"); }
        if (!/^\d{15}$/.test(p.IMEI ?? "")) return reply(res, { ERROR: [{ MESSAGE: "Invalid IMEI" }] });
        const ref = String(next++);
        orders.set(ref, { service: id, imei: p.IMEI, checks: 0 });
        return reply(res, { SUCCESS: [{ MESSAGE: "Order received", REFERENCEID: ref }] });
      }
      if (action === "getimeiorder") {
        const o = orders.get(String(p.ID ?? ""));
        if (!o) return reply(res, { ERROR: [{ MESSAGE: "Invalid Order ID" }] });
        o.checks++;
        if (o.service === "102" || (o.service === "101" && o.imei.endsWith("0"))) return reply(res, { SUCCESS: [{ STATUS: 3, CODE: "", COMMENTS: "IMEI is blacklisted" }] });
        if (o.service === "103" || o.checks < 2) return reply(res, { SUCCESS: [{ STATUS: 1, CODE: "", COMMENTS: "In process" }] });
        return reply(res, { SUCCESS: [{ STATUS: 4, CODE: `Unlocked successfully (${o.imei}). Insert a SIM from another carrier and connect to Wi-Fi.`, COMMENTS: "" }] });
      }
      return reply(res, { ERROR: [{ MESSAGE: "Invalid Action" }] });
    });
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      resolve({ url: `http://127.0.0.1:${address.port}`, log, orders, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 4010);
  startFakeSupplier({ port }).then((s) => console.log(`Fake Dhru supplier on ${s.url}  (username demo, API key demo-key)`));
}
