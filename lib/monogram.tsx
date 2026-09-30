import { getProfile } from "@/lib/profile";

/** "Anshu Karn" -> "AK": first letters of the first and last names, from the profile. */
export async function initials(): Promise<string> {
  const name = (await getProfile().catch(() => null))?.full_name?.trim() ?? "";
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return "•";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** The site's icon: initials in teal on the dark ink background (Flight Deck). */
export function Monogram({ text, size, rounded = true }: { text: string; size: number; rounded?: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0e1216",
        borderRadius: rounded ? size * 0.22 : 0,
        color: "#4fd1c5",
        fontSize: size * (text.length > 1 ? 0.46 : 0.6),
        fontWeight: 700,
        letterSpacing: -size * 0.02,
      }}
    >
      {text}
    </div>
  );
}
