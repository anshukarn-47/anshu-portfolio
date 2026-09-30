import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeAdminPath } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

const errorMessages: Record<string, string> = {
  not_admin: "This account doesn't have admin access.",
};

export default async function AdminLoginPage(props: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const searchParams = await props.searchParams;
  const next = safeAdminPath(searchParams.next);

  // Already signed in as an admin? Skip the form.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && searchParams.error !== "not_admin") {
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (isAdmin) redirect(next);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Admin sign in</h1>
        <p className="mt-1 text-sm text-text-dim">Manage portfolio content.</p>
        <div className="mt-8">
          <LoginForm
            next={next}
            initialError={searchParams.error ? errorMessages[searchParams.error] : undefined}
          />
        </div>
      </div>
    </main>
  );
}
