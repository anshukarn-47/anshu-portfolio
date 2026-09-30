import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";
import { SiteHeader } from "@/components/navigation/site-header";
import { RouteProgress } from "@/components/navigation/route-progress";
import { MotionProvider } from "@/components/motion-provider";
import { ThemeScript } from "@/components/theme/theme-script";
import { Tracker } from "@/components/analytics/tracker";
import { PREVIEW_IMAGE, SITE_ROLE, SITE_URL, siteName } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-space-grotesk",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

/**
 * Site-wide metadata from the profile in Supabase: every page's <title> is
 * "Page | Name", and link previews default to the home page's title and
 * description. The preview image is app/opengraph-image.tsx.
 */
export async function generateMetadata(): Promise<Metadata> {
  const name = await siteName();
  const title = `${name} | ${SITE_ROLE}`;
  const description = `Case studies, skills and an AI assistant for ${name}'s product work.`;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s | ${name}` },
    description,
    applicationName: name,
    authors: [{ name }],
    openGraph: { type: "website", siteName: name, locale: "en_US", title, description, images: [PREVIEW_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [PREVIEW_IMAGE.url] },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const name = await siteName();
  return (
    // suppressHydrationWarning: pre-paint scripts set data-theme / data-hero-count on <html>.
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <MotionProvider>
          <RouteProgress />
          <SiteHeader name={name} />
          {children}
          <Tracker />
        </MotionProvider>
      </body>
    </html>
  );
}
