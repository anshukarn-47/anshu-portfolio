import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { logout } from "../login/actions";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

// Always check the session on the server; never serve a cached admin page.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();

  return (
    <div className="min-h-screen">
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <span className="font-display text-sm font-semibold">Portfolio admin</span>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-text-dim sm:inline">{user.email}</span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-rule px-3 py-1.5 text-sm hover:bg-panel-2"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-1">
          <AdminNav />
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>
    </div>
  );
}
