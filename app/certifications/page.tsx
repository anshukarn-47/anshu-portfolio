import type { Metadata } from "next";
import Link from "next/link";
import { getCertifications, type PublicCertification } from "@/lib/certifications";
import { formatMonthYear, isSafeSrc } from "@/lib/format";
import { EmptyState, PageIntro } from "@/components/ui/page-intro";
import { HashHighlight } from "@/components/ui/hash-highlight";
import { StatusPill } from "@/components/ui/status-pill";
import { CopyButton } from "@/components/ui/copy-button";
import { pageMetadata } from "@/lib/site";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Certifications",
    description: "Professional certifications, with links to verify each credential.",
    path: "/certifications",
  });
}

// Cached; saving in /admin revalidates immediately. This is a fallback.
export const revalidate = 3600;

export default async function CertificationsPage() {
  const certifications = await getCertifications();
  const current = certifications.filter((c) => !c.expired);
  const expired = certifications.filter((c) => c.expired);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <HashHighlight />
      <PageIntro title="Certifications">Credentials, with a link to verify each one with the issuer where available.</PageIntro>

      {certifications.length === 0 ? (
        <EmptyState>Certifications are on their way.</EmptyState>
      ) : (
        <>
          {current.length > 0 && (
            <ul className="mt-10 grid gap-3 md:grid-cols-2">
              {current.map((c) => (
                <li key={c.id}>
                  <CertificationCard cert={c} />
                </li>
              ))}
            </ul>
          )}
          {expired.length > 0 && (
            <section className="mt-12" aria-labelledby="expired-title">
              <h2 id="expired-title" className="text-xl text-text-dim">
                Expired
              </h2>
              <ul className="mt-4 grid gap-3 md:grid-cols-2">
                {expired.map((c) => (
                  <li key={c.id}>
                    <CertificationCard cert={c} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function CertificationCard({ cert }: { cert: PublicCertification }) {
  const issued = formatMonthYear(cert.issue_date);
  const expires = formatMonthYear(cert.expiry_date);

  return (
    <article
      id={cert.id}
      className="flex h-full scroll-mt-8 flex-col rounded-lg border border-rule bg-panel p-5 data-[hash-target]:border-text-dim data-[hash-target]:bg-panel-2"
    >
      <div className="flex items-start gap-4">
        {isSafeSrc(cert.certificate_image_url) && (
          <a href={cert.certificate_image_url} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cert.certificate_image_url}
              alt={`${cert.name} certificate`}
              className="h-14 w-14 rounded-md border border-rule bg-panel-2 object-contain"
              loading="lazy"
            />
          </a>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-lg text-text">{cert.name}</h2>
            <StatusPill tone={cert.expired ? "idle" : "ok"}>{cert.expired ? "expired" : "active"}</StatusPill>
          </div>
          <p className="mt-1 text-sm text-text-dim">
            {cert.issuer}
            {cert.featured && !cert.expired && <span className="text-text-faint"> · featured</span>}
          </p>
          {(issued || expires) && (
            <p className="mt-1 text-sm text-text-faint">
              {issued && (
                <>
                  Issued <span className="font-mono tabular-nums">{issued}</span>
                </>
              )}
              {issued && expires && " · "}
              {expires && (
                <>
                  {cert.expired ? "Expired" : "Valid until"} <span className="font-mono tabular-nums">{expires}</span>
                </>
              )}
            </p>
          )}
        </div>
      </div>

      {cert.description && <p className="mt-3 text-sm text-text-dim">{cert.description}</p>}

      {cert.skills.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Skills covered">
          {cert.skills.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/skills#${s.slug}`}
                className="block rounded-full border border-rule px-2.5 py-0.5 text-xs text-text-dim transition-colors hover:border-text-faint hover:text-text"
              >
                {s.name}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {(cert.credential_url || cert.credential_id) && (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5 text-sm">
          {cert.credential_id ? (
            <span className="flex items-center gap-2 text-text-faint">
              Credential {cert.credential_id}
              <CopyButton value={cert.credential_id} label={`Copy credential ID for ${cert.name}`} />
            </span>
          ) : (
            <span />
          )}
          {cert.credential_url && (
            <a href={cert.credential_url} target="_blank" rel="noopener noreferrer" className="rounded-md text-text hover:underline">
              Verify credential ↗
            </a>
          )}
        </div>
      )}
    </article>
  );
}
