import type { Metadata } from "next";
import Link from "next/link";
import { getProfile } from "@/lib/profile";
import { getSkillsByCategory } from "@/lib/skills";
import { isSafeSrc } from "@/lib/format";
import { Markdown } from "@/components/ui/markdown";
import { EmptyState, PageIntro } from "@/components/ui/page-intro";
import { CopyButton } from "@/components/ui/copy-button";
import { ContactForm } from "@/components/contact/contact-form";
import { contactConfigured } from "@/lib/contact/resend";
import { pageMetadata } from "@/lib/site";

// Cached; saving in /admin revalidates immediately. This is a fallback.
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const profile = await getProfile();
  return pageMetadata({ title: "About", description: profile?.headline, path: "/about" });
}

const sections = [
  { href: "/work", label: "Work", description: "Case studies" },
  { href: "/skills", label: "Skills", description: "What I work with" },
  { href: "/certifications", label: "Certifications", description: "Verified credentials" },
  { href: "/achievements", label: "Achievements", description: "Measurable impact" },
  { href: "/prototype-lab", label: "Prototype lab", description: "Experiments and demos" },
  { href: "/ai-lab", label: "AI lab", description: "Ask questions about this portfolio" },
];

/** The site's own stack, for the "Built with" note. */
const builtWith = [
  "Next.js",
  "TypeScript",
  "Tailwind CSS",
  "Framer Motion",
  "Supabase",
  "PostgreSQL",
  "pgvector",
  "Claude",
  "Voyage AI",
  "Resend",
];

export default async function AboutPage() {
  const [profile, categories] = await Promise.all([getProfile(), getSkillsByCategory()]);

  if (!profile) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <PageIntro title="About" />
        <EmptyState>This page is on its way.</EmptyState>
      </main>
    );
  }

  const coreSkills = categories.flatMap((c) => c.skills).filter((s) => s.featured);
  const resumeUrl = isSafeSrc(profile.resume_url) ? profile.resume_url : null;
  const contact = [
    profile.email ? { href: `mailto:${profile.email}`, label: "Email", external: false } : null,
    ...profile.socialLinks.map((l) => ({ href: l.href, label: l.label, external: true })),
  ].filter((c): c is { href: string; label: string; external: boolean } => c !== null);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="grid gap-12 lg:grid-cols-[55fr_45fr]">
        <div>
          <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {isSafeSrc(profile.avatar_url) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={profile.full_name} className="h-24 w-24 shrink-0 rounded-lg border border-rule object-cover" />
            )}
            <div>
              <h1 className="text-4xl sm:text-5xl">{profile.full_name}</h1>
              {profile.headline && <p className="mt-2 max-w-prose text-lg text-text-dim">{profile.headline}</p>}
              {profile.location && <p className="mt-1 text-sm text-text-faint">{profile.location}</p>}
            </div>
          </header>

          {(contact.length > 0 || resumeUrl) && (
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {resumeUrl && (
                <a
                  href={resumeUrl}
                  data-track="resume_download"
                  {...(resumeUrl.startsWith("/") ? { download: "" } : { target: "_blank", rel: "noopener noreferrer" })}
                  className="rounded-md bg-text px-4 py-2 text-sm font-medium text-ink transition-opacity hover:opacity-90"
                >
                  Download résumé
                </a>
              )}
              {contact.map((c) => (
                <a
                  key={c.label}
                  href={c.href}
                  {...(c.external ? { target: "_blank", rel: "noopener noreferrer me" } : {})}
                  className="rounded-md border border-rule px-4 py-2 text-sm text-text transition-colors hover:bg-panel"
                >
                  {c.label}
                  {c.external && <span aria-hidden> ↗</span>}
                </a>
              ))}
            </div>
          )}

          <dl className="mt-6 space-y-2 text-sm">
            {profile.email && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <dt className="w-28 text-text-faint">Email</dt>
                <dd className="flex items-center gap-2 text-text">
                  {profile.email}
                  <CopyButton value={profile.email} label="Copy email address" />
                </dd>
              </div>
            )}
            {resumeUrl && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <dt className="w-28 text-text-faint">Résumé link</dt>
                <dd className="flex items-center gap-2">
                  <CopyButton value={resumeUrl} absolute={resumeUrl.startsWith("/")} label="Copy résumé link" />
                </dd>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <dt className="w-28 text-text-faint">Portfolio link</dt>
              <dd className="flex items-center gap-2">
                <CopyButton value="/" absolute label="Copy portfolio link" />
              </dd>
            </div>
          </dl>

          {profile.bio && (
            <Markdown className="mt-10" headingLevel={2}>
              {profile.bio}
            </Markdown>
          )}

          {contactConfigured() && (
            <section id="contact" aria-labelledby="contact-title" className="mt-12 scroll-mt-24">
              <h2 id="contact-title" className="text-2xl">
                Get in touch
              </h2>
              <ContactForm />
            </section>
          )}
        </div>

        <aside className="space-y-10">
          {coreSkills.length > 0 && (
            <section aria-labelledby="core-skills">
              <h2 id="core-skills" className="text-xl">
                Core skills
              </h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {coreSkills.map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={`/skills#${s.slug}`}
                      className="block rounded-full border border-rule px-3 py-1 text-sm text-text-dim transition-colors hover:border-text-faint hover:text-text"
                    >
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <nav aria-labelledby="explore-title">
            <h2 id="explore-title" className="text-xl">
              Explore
            </h2>
            <ul className="mt-4 divide-y divide-rule rounded-lg border border-rule bg-panel">
              {sections.map((s) => (
                <li key={s.href}>
                  <Link href={s.href} className="flex items-baseline justify-between gap-4 rounded-lg px-4 py-3 transition-colors hover:bg-panel-2">
                    <span className="text-text">{s.label}</span>
                    <span className="text-sm text-text-faint">{s.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <section aria-labelledby="built-with-title">
            <h2 id="built-with-title" className="font-sans text-xs font-medium uppercase tracking-wider text-text-faint">
              Built with
            </h2>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-text-dim">
              {builtWith.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>

            <h2 className="mt-8 text-xl">Why I built it</h2>
            <p className="mt-3 max-w-prose text-sm text-text-dim">
              I wanted my portfolio to demonstrate the same capabilities I bring to product work: understanding users,
              structuring information, prototyping experiences, integrating AI, grounding outputs in evidence, and measuring
              engagement.
            </p>
            <p className="mt-3 max-w-prose text-xs text-text-faint">
              Engagement is measured without cookies or personal data, and not at all if your browser sends Do Not Track or
              Global Privacy Control.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
