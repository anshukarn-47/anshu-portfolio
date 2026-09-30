import { ImageResponse } from "next/og";
import { Monogram, initials } from "@/lib/monogram";

/** Browser tab icon (replaces the default Next.js favicon). */
export const size = { width: 48, height: 48 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Icon() {
  return new ImageResponse(<Monogram text={await initials()} size={size.width} />, size);
}
