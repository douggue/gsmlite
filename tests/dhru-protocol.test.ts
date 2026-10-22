import { describe, expect, it } from "vitest";
import {
  decodeCustomFields,
  decodeParams,
  encodeParams,
  endpointUrl,
  isAccountProblem,
  parseAccountInfo,
  parseOrderStatus,
  parsePlaceOrder,
  parseReply,
  parseServiceList,
  requestBody,
  resultText,
  toCents,
} from "@/lib/dhru/protocol";

describe("Dhru Fusion protocol", () => {
  it("builds the endpoint from any way the address is typed", () => {
    expect(endpointUrl("supplier.com")).toBe("https://supplier.com/api/index.php");
    expect(endpointUrl("https://supplier.com/")).toBe("https://supplier.com/api/index.php");
    expect(endpointUrl("https://supplier.com/api/index.php")).toBe("https://supplier.com/api/index.php");
  });

  it("encodes parameters as XML (escaped) or base64 JSON", () => {
    expect(encodeParams({ ID: 5, IMEI: "1<2&3" }, "xml")).toBe("<PARAMETERS><ID>5</ID><IMEI>1&lt;2&amp;3</IMEI></PARAMETERS>");
    expect(JSON.parse(Buffer.from(encodeParams({ id: 5 }, "json"), "base64").toString())).toEqual({ ID: "5" });
    expect(decodeParams(encodeParams({ ID: 7, IMEI: "a&b" }, "xml"))).toEqual({ ID: "7", IMEI: "a&b" });
  });

  it("sends the form fields Dhru expects", () => {
    const b = requestBody({ username: "u@x.com", apiKey: "KEY" }, "getimeiorder", { ID: 9 });
    expect(b.get("username")).toBe("u@x.com");
    expect(b.get("apiaccesskey")).toBe("KEY");
    expect(b.get("action")).toBe("getimeiorder");
    expect(b.get("requestformat")).toBe("JSON");
    expect(b.get("parameters")).toBe("<PARAMETERS><ID>9</ID></PARAMETERS>");
  });

  it("reads custom fields sent as base64 JSON or plain JSON", () => {
    const b64 = Buffer.from(JSON.stringify({ "Picture link": "x" })).toString("base64");
    expect(decodeCustomFields(b64)).toEqual({ "Picture link": "x" });
    expect(decodeCustomFields('{"Username":"shop"}')).toEqual({ Username: "shop" });
    expect(decodeCustomFields(undefined)).toEqual({});
  });

  it("parses replies even with junk before the JSON", () => {
    expect(parseReply('﻿Notice: x\n{"SUCCESS":[{"MESSAGE":"ok"}]}')).toEqual({ SUCCESS: [{ MESSAGE: "ok" }] });
    expect(parseReply("<html>502</html>")).toBeNull();
  });

  it("reads balance from AccoutInfo (Dhru's spelling) or AccountInfo", () => {
    expect(parseAccountInfo({ SUCCESS: [{ AccoutInfo: { credit: "$1,234.50", currency: "USD", mail: "a@b.c" } }] })).toEqual({
      credit: 123450,
      currency: "USD",
      email: "a@b.c",
    });
    expect(parseAccountInfo({ SUCCESS: [{ AccountInfo: { creditraw: 25.4, credit: "$25.40", currency: "USD" } }] }).credit).toBe(2540);
    expect(toCents("1.005")).toBe(101);
  });

  it("flattens the service list with inputs and quantities", () => {
    const list = parseServiceList({
      SUCCESS: [{
        LIST: {
          Apple: {
            GROUPNAME: "Apple", GROUPTYPE: "IMEI",
            SERVICES: {
              "6904": {
                SERVICEID: 6904, SERVICETYPE: "IMEI", SERVICENAME: "iPhone AT&T", CREDIT: "12.5", TIME: "1-3 Days",
                "Requires.SN": "Required", "Requires.Network": "None",
                CUSTOM: { customname: "IMEI or SN", bulk: "1" },
                "Requires.Custom": [{ fieldname: "Carrier", fieldtype: "dropdown", fieldoptions: "AT&T,Cricket", required: "on" }],
              },
            },
          },
          Credits: { GROUPNAME: "Credits", GROUPTYPE: "SERVER", SERVICES: { "812": { SERVICEID: 812, SERVICENAME: "Tool credits", CREDIT: 1.2, QNT: 1, MINQNT: 10, MAXQNT: 500 } } },
        },
      }],
    });
    expect(list).toHaveLength(2);
    const [a, c] = list;
    expect(a).toMatchObject({ remoteId: "6904", type: "IMEI", credit: 1250, identifierLabel: "IMEI or SN", bulk: true, qty: null });
    expect(a.fields).toEqual([
      { name: "SN", kind: "param", type: "text", required: true },
      { name: "Carrier", kind: "custom", type: "select", required: true, options: ["AT&T", "Cricket"] },
    ]);
    expect(c).toMatchObject({ remoteId: "812", type: "SERVER", credit: 120, qty: { min: 10, max: 500 } });
  });

  it("reads order placement and status replies", () => {
    expect(parsePlaceOrder({ SUCCESS: [{ MESSAGE: "Order received", REFERENCEID: 98213 }] })).toEqual({ ref: "98213" });
    expect(parsePlaceOrder({ ERROR: [{ MESSAGE: "Invalid IMEI" }] })).toEqual({ error: "Invalid IMEI" });
    expect(parseOrderStatus({ SUCCESS: [{ STATUS: "4", CODE: "Unlocked<br>Reboot" }] })).toEqual({ status: "SUCCESS", code: "Unlocked<br>Reboot", comments: "" });
    expect(parseOrderStatus({ SUCCESS: [{ STATUS: 3, CODE: "Blacklisted" }] })).toMatchObject({ status: "REJECTED" });
    expect(parseOrderStatus({ SUCCESS: [{ STATUS: 1 }] })).toMatchObject({ status: "IN_PROCESS" });
    expect(parseOrderStatus({ SUCCESS: [{ STATUS: 7 }] })).toEqual({ error: "Unknown STATUS 7" });
  });

  it("turns HTML results into safe plain text", () => {
    expect(resultText("Unlocked<br>Code: <b>1234</b>&nbsp;<script>x</script>")).toBe("Unlocked\nCode: 1234 x");
  });

  it("tells account problems apart from order problems", () => {
    expect(isAccountProblem("Not enough credits")).toBe(true);
    expect(isAccountProblem("Authentication Failed")).toBe(true);
    expect(isAccountProblem("IMEI is blacklisted")).toBe(false);
    expect(isAccountProblem("Invalid IMEI")).toBe(false);
  });
});
