import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getIndexStatus } from "@/lib/rag/ingest";
import { AiIndexPanel } from "@/components/admin/ai-index-panel";

const sections = [
  { table: "work", label: "Work", href: "/admin/work" },
  { table: "skills", label: "Skills", href: "/admin/skills" },
  { table: "certifications", label: "Certifications", href: "/admin/certifications" },
  { table: "achievements", label: "Achievements", href: "/admin/achievements" },
  { table: "prototypes", label: "Prototypes", href: "/admin/prototypes" },
  { table: "contact_messages", label: "Messages", href: "/admin/messages" },
] as const;

export default async function AdminHomePage() {
  const { supabase } = await requireAdmin();

  const [counts, { count: profileCount }, index] = await Promise.all([
    Promise.all(
      sections.map(async ({ table }) => {
        const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
        return count ?? 0;
      })
    ),
    supabase.from("profile").select("id", { count: "exact", head: true }),
    getIndexStatus(),
  ]);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-text-dim">Manage the content shown on your portfolio.</p>

      {!profileCount && (
        <Link
          href="/admin/profile"
          className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-signal-amber px-4 py-3 text-sm"
        >
          <span>Your profile isn&apos;t set up yet, so the About page is empty.</span>
          <span className="whitespace-nowrap font-medium">Set up profile →</span>
        </Link>
      )}

      <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {sections.map(({ table, label, href }, i) => (
          <li key={table}>
            <Link href={href} className="block rounded-lg border border-rule bg-panel p-4 transition-colors hover:bg-panel-2">
              <p className="text-sm text-text-dim">{label}</p>
              <p className="mt-1 font-mono text-2xl font-medium tabular-nums">{counts[i]}</p>
            </Link>
          </li>
        ))}
      </ul>

      <AiIndexPanel
        {...index}
        keys={{ anthropic: !!process.env.ANTHROPIC_API_KEY, voyage: !!process.env.VOYAGE_API_KEY }}
      />
    </>
  );
}
