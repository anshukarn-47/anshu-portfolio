"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Marks the element named by the URL hash with `data-hash-target`, so it can be
 * highlighted. CSS `:target` doesn't update on Next.js client-side navigation.
 */
export function HashHighlight() {
  const pathname = usePathname();

  useEffect(() => {
    let current: Element | null = null;
    const apply = () => {
      current?.removeAttribute("data-hash-target");
      const id = decodeURIComponent(window.location.hash.slice(1));
      current = id ? document.getElementById(id) : null;
      current?.setAttribute("data-hash-target", "");
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => {
      window.removeEventListener("hashchange", apply);
      current?.removeAttribute("data-hash-target");
    };
  }, [pathname]);

  return null;
}
