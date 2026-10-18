import "server-only";
import type { Supplier } from "@prisma/client";
import { prisma } from "../db";
import { decrypt } from "../crypto";
import { endpointUrl, parseReply, requestBody, type DhruAction, type DhruParams, type DhruReply } from "./protocol";

/** Outcome of one call. `reply` is null when the supplier didn't answer with readable JSON (timeout, HTML, 5xx). */
export type CallResult = { reply: DhruReply | null; httpStatus: number | null; error: string | null };

const TIMEOUT_MS = 25_000;

/**
 * Call a supplier's Dhru Fusion API and log the exchange (API key removed). Never throws:
 * a network problem comes back as { reply: null, error }.
 */
export async function callSupplier(supplier: Supplier, action: DhruAction, params?: DhruParams): Promise<CallResult> {
  const apiKey = decrypt(supplier.apiKeyEncrypted);
  const body = requestBody({ username: supplier.username, apiKey }, action, params, supplier.paramFormat === "json" ? "json" : "xml");
  const started = Date.now();
  let httpStatus: number | null = null;
  let text = "";
  let error: string | null = null;
  try {
    const res = await fetch(endpointUrl(supplier.baseUrl), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
      redirect: "follow",
    });
    httpStatus = res.status;
    text = await res.text();
  } catch (e) {
    error = e instanceof Error && e.name === "TimeoutError" ? `No answer within ${TIMEOUT_MS / 1000} s` : `Network error: ${e instanceof Error ? e.message : String(e)}`;
  }
  const reply = text ? parseReply(text) : null;
  if (!error && !reply) error = `Unreadable reply (HTTP ${httpStatus ?? "?"})`;
  const redacted = new URLSearchParams(body);
  redacted.set("apiaccesskey", "•••");
  await prisma.supplierLog
    .create({
      data: {
        supplierId: supplier.id,
        action,
        request: decodeURIComponent(redacted.toString()).slice(0, 4000),
        response: (text || error || "").slice(0, 8000),
        httpStatus,
        ms: Date.now() - started,
        ok: !!reply && !reply.ERROR,
      },
    })
    .catch((e) => console.error("supplier log failed", e));
  return { reply, httpStatus, error };
}
