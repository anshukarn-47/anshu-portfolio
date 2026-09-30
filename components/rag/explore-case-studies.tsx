import Link from "next/link";

/** The way out when the AI assistant is unavailable (AI_MESSAGES.unavailable). */
export function ExploreCaseStudies() {
  return (
    <p className="mt-1 text-text-dim">
      You can explore the{" "}
      <Link href="/work" className="text-text underline decoration-rule underline-offset-4 hover:decoration-signal-teal">
        case studies
      </Link>{" "}
      instead.
    </p>
  );
}
