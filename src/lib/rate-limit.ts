import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "./db";

/**
 * Fixed-window limit shared by every server (stored in the database, same table Better Auth uses, keys prefixed "gl:").
 * Returns true while `key` has made at most `max` calls in the current `windowSeconds`.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const now = Date.now();
  const start = now - windowSeconds * 1000;
  const k = `gl:${key}`;
  const [row] = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "rateLimit" (id, key, count, "lastRequest") VALUES (${randomUUID()}, ${k}, 1, ${now})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN "rateLimit"."lastRequest" < ${start} THEN 1 ELSE "rateLimit".count + 1 END,
      "lastRequest" = CASE WHEN "rateLimit"."lastRequest" < ${start} THEN ${now} ELSE "rateLimit"."lastRequest" END
    RETURNING count`;
  return (row?.count ?? 1) <= max;
}
