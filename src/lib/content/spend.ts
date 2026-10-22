import "server-only";
import { prisma } from "../db";
import { getSettings } from "../settings";

export function monthStart(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Spent this calendar month (UTC), in millionths of a dollar. */
export async function monthSpendMicros(): Promise<number> {
  const r = await prisma.contentSpend.aggregate({ where: { createdAt: { gte: monthStart() } }, _sum: { costMicros: true } });
  return r._sum.costMicros ?? 0;
}

/** True while the month's spend plus this estimate stays within the budget set in admin. */
export async function withinBudget(estimateMicros: number): Promise<boolean> {
  const { contentMachine } = await getSettings();
  return (await monthSpendMicros()) + estimateMicros <= contentMachine.budgetUsd * 1_000_000;
}

export async function recordSpend(kind: "ai" | "keywords", costMicros: number, note: string) {
  if (costMicros > 0) await prisma.contentSpend.create({ data: { kind, costMicros: Math.round(costMicros), note: note.slice(0, 300) } });
}
