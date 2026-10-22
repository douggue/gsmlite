import { AdminLoginForm } from "./form";

export const metadata = { title: "Staff sign in" };

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ setup?: string; ip?: string }> }) {
  const { setup, ip } = await searchParams;
  return (
    <div className="grid min-h-dvh place-items-center gap-3 bg-midnight p-4">
      <div className="w-full max-w-md space-y-3">
        {setup && <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success" role="status">Admin account created. Sign in now; you'll set up two-factor authentication with an authenticator app (Google Authenticator, Authy…).</p>}
        {ip && <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">The admin does not open from this internet address (Security → allowlist). Use an allowed connection, or set ADMIN_IP_ALLOWLIST_OFF=1 in the hosting environment.</p>}
        <AdminLoginForm />
      </div>
    </div>
  );
}
