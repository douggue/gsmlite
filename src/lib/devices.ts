import { prisma } from "./db";
import { getSettings } from "./settings";

/**
 * Remember which browser (gl_dev cookie) and IP each account signs in from.
 * When a browser is already used by too many other accounts, the sign-in is flagged for review
 * (blueprint §8: one person farming several accounts for referral rewards or limits).
 */
export async function recordDevice(userId: string, deviceId: string | null, ip: string | null, userAgent: string | null) {
  if (!deviceId || !/^[A-Za-z0-9_-]{16,64}$/.test(deviceId)) return;
  const existing = await prisma.deviceSeen.findUnique({ where: { userId_deviceId: { userId, deviceId } } });
  // A sign-in from a browser this account never used: tell the customer (not on the very first one).
  if (!existing && (await prisma.deviceSeen.count({ where: { userId } })) > 0) {
    const { notify } = await import("./notify");
    await notify(userId, "new_device", { device: deviceLabel(userAgent), ip: ip ?? "?" }, "/account/security").catch(() => {});
  }
  await prisma.deviceSeen.upsert({
    where: { userId_deviceId: { userId, deviceId } },
    create: { userId, deviceId, ip, userAgent: userAgent?.slice(0, 300) },
    update: { lastSeen: new Date(), ip, userAgent: userAgent?.slice(0, 300) },
  });
  if (existing) return; // only check the first time this account appears on this browser

  const others = await prisma.deviceSeen.findMany({ where: { deviceId, NOT: { userId } }, select: { userId: true }, distinct: ["userId"] });
  const { maxAccountsPerDevice } = await getSettings();
  if (others.length >= maxAccountsPerDevice) {
    const already = await prisma.riskFlag.findFirst({ where: { userId, status: "OPEN", reason: { startsWith: "Shared browser" } } });
    if (!already) {
      await prisma.riskFlag.create({
        data: { userId, reason: `Shared browser: ${others.length} other account(s) signed in from the same device` },
      });
    }
  }
}

/** Other accounts that used the same browsers or IPs as this user (admin customer page / security view). */
export async function linkedAccounts(userId: string) {
  const mine = await prisma.deviceSeen.findMany({ where: { userId } });
  const deviceIds = [...new Set(mine.map((d) => d.deviceId))];
  const ips = [...new Set(mine.map((d) => d.ip).filter((x): x is string => !!x))];
  if (!deviceIds.length && !ips.length) return [];
  const rows = await prisma.deviceSeen.findMany({
    where: { NOT: { userId }, OR: [{ deviceId: { in: deviceIds } }, ...(ips.length ? [{ ip: { in: ips } }] : [])] },
    orderBy: { lastSeen: "desc" },
    take: 100,
  });
  const byUser = new Map<string, { sameDevice: boolean; sameIp: boolean; lastSeen: Date }>();
  for (const r of rows) {
    const cur = byUser.get(r.userId) ?? { sameDevice: false, sameIp: false, lastSeen: r.lastSeen };
    if (deviceIds.includes(r.deviceId)) cur.sameDevice = true;
    if (r.ip && ips.includes(r.ip)) cur.sameIp = true;
    if (r.lastSeen > cur.lastSeen) cur.lastSeen = r.lastSeen;
    byUser.set(r.userId, cur);
  }
  const users = await prisma.user.findMany({ where: { id: { in: [...byUser.keys()] } }, select: { id: true, name: true, email: true, status: true } });
  return users.map((u) => ({ ...u, ...byUser.get(u.id)! })).sort((a, b) => Number(b.sameDevice) - Number(a.sameDevice));
}

/** "Safari · iPhone" from a user agent, for alerts and the sessions list. */
export function deviceLabel(ua: string | null) {
  if (!ua) return "?";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  const b = /Edg\//.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${b}${os ? ` · ${os}` : ""}`;
}
