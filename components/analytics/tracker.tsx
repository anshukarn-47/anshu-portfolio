"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { isUntrackedPath, type TrackPayload, type TrackedEvent } from "@/lib/analytics/shared";

/** Visitors who ask not to be tracked (Do Not Track or Global Privacy Control) aren't. */
function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

function send(payload: TrackPayload) {
  if (optedOut() || isUntrackedPath(payload.path)) return;
  const body = JSON.stringify(payload);
  // sendBeacon survives page unloads (e.g. an outbound click); fetch keepalive is the fallback.
  if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) {
    fetch("/api/track", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
  }
}

/** Sends one named event for the current page (e.g. an arcade game starting), with an optional target such as a slug. */
export function trackEvent(name: TrackedEvent, target?: string) {
  send({ name, path: window.location.pathname, target: target ?? null });
}

/**
 * Privacy-friendly analytics: no cookies or local storage, nothing personal sent.
 * Records a page view on each navigation (including the case study overlay, which
 * updates the URL), résumé downloads (links marked data-track="resume_download")
 * and clicks on links to other sites (domain only).
 */
export function Tracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (last.current === pathname) return; // strict mode runs effects twice in development
    // The external referrer only matters for the first page of a visit; later pages are internal.
    const referrer = last.current === null ? document.referrer || null : null;
    last.current = pathname;
    send({ name: "pageview", path: pathname, referrer });
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const path = window.location.pathname;
      if (link.dataset.track === "resume_download") {
        send({ name: "resume_download", path });
      } else if (/^https?:$/.test(link.protocol) && link.host !== window.location.host) {
        send({ name: "outbound_click", path, target: link.hostname.replace(/^www\./, "") });
      }
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
