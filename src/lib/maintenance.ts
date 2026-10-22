import "server-only";
import { getSettings } from "./settings";
import { isStaff } from "./permissions";

/** True while maintenance mode is on, for everyone but staff (who keep testing). */
export async function closedFor(user: { role: string } | null) {
  const s = await getSettings();
  return s.maintenance.on && !(user && isStaff(user.role));
}
