"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { StatusPill } from "@/components/ui/status-pill";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const links = [
  { href: "/work", label: "Work" },
  { href: "/skills", label: "Skills" },
  { href: "/certifications", label: "Certifications" },
  { href: "/achievements", label: "Achievements" },
  { href: "/prototype-lab", label: "Prototype lab" },
  { href: "/ai-lab", label: "AI lab" },
  { href: "/about", label: "About" },
];

/** Site-wide header for public pages (the admin area has its own). `name` comes from the profile. */
export function SiteHeader({ name }: { name: string }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;

  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-display text-base font-semibold text-text">
            {name}
          </Link>
          <StatusPill tone="live">live</StatusPill>
        </div>
        <div className="ml-auto sm:order-last sm:ml-0">
          <ThemeToggle />
        </div>
        <nav aria-label="Main" className="-mx-1 min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] sm:flex-none [&::-webkit-scrollbar]:hidden sm:ml-auto">
          <ul className="flex gap-1 text-sm">
            {links.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`relative block whitespace-nowrap rounded-md px-2 py-1 transition-colors ${
                      active ? "text-text" : "text-text-dim hover:text-text"
                    }`}
                  >
                    {label}
                    {/* One shared element (layoutId) that slides to the active link on navigation.
                        Under reduced motion MotionConfig makes the move instant. */}
                    {active && (
                      <motion.span
                        layoutId="nav-active-indicator"
                        aria-hidden
                        className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-signal-teal"
                        transition={{ type: "spring", stiffness: 520, damping: 42 }}
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
