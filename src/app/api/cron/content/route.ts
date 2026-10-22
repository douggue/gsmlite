import { NextResponse, type NextRequest } from "next/server";
import { runDaily } from "@/lib/content/machine";

/**
 * Content machine, once a day (`Authorization: Bearer $CRON_SECRET`): drafts for new services, brand hubs and the
 * best keyword ideas (research on Mondays), and refresh drafts when a price or time changed. Never publishes.
 */
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runDaily());
}
