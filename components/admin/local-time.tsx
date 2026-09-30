"use client";

import { useEffect, useState } from "react";

const format = (iso: string, timeZone?: string) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(iso));

/**
 * A timestamp in the viewer's own time zone. The server renders it in UTC
 * (it can't know the viewer's zone); the browser swaps in local time.
 */
export function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState(() => `${format(iso, "UTC")} UTC`);
  useEffect(() => setText(format(iso)), [iso]);
  return (
    <time dateTime={iso} className="font-mono tabular-nums">
      {text}
    </time>
  );
}
