import { ImageResponse } from "next/og";
import { Monogram, initials } from "@/lib/monogram";

/** Home-screen icon for iOS (180 × 180). Square: iOS applies its own rounded mask. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function AppleIcon() {
  return new ImageResponse(<Monogram text={await initials()} size={size.width} rounded={false} />, size);
}
