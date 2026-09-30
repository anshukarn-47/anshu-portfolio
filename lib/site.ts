import "server-only";
import type { Metadata } from "next";
import { getProfile } from "@/lib/profile";

/**
 * The site's public origin, used for absolute URLs in link previews (Open
 * Graph), canonical links, the sitemap and robots.txt. Set NEXT_PUBLIC_SITE_URL
 * to the production domain (e.g. https://anshukarn.com); on Vercel the
 * project's production domain is used if it isn't set.
 */
export const SITE_URL = (() => {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
})();

/** The role shown after the owner's name in the home page title and link previews. */
export const SITE_ROLE = "Product Manager";

/** The owner's name, from the profile in Supabase. */
export async function siteName(): Promise<string> {
  try {
    return (await getProfile())?.full_name?.trim() || "Portfolio";
  } catch {
    return "Portfolio"; // metadata should never take a page down
  }
}

/**
 * The generated link-preview image (app/opengraph-image.tsx). Pages that set
 * their own openGraph replace the inherited one wholesale, image included, so
 * it's listed explicitly.
 */
export const PREVIEW_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "Portfolio preview: name, role and headline metrics" };

/**
 * Title, description, canonical URL and matching link-preview fields for a page.
 * The <title> gets " | Name" from the root layout's template; link previews
 * don't use that template, so the name is added to og:title here. Child pages
 * restate openGraph/twitter because Next merges metadata shallowly. The
 * preview image comes from app/opengraph-image.tsx for every page.
 */
export async function pageMetadata({ title, description, path }: { title: string; description?: string | null; path: string }): Promise<Metadata> {
  const name = await siteName();
  const previewTitle = `${title} | ${name}`;
  const desc = description?.trim() || undefined;
  return {
    title,
    description: desc,
    alternates: { canonical: path },
    openGraph: { title: previewTitle, description: desc, url: path, type: "website", siteName: name, images: [PREVIEW_IMAGE] },
    twitter: { card: "summary_large_image", title: previewTitle, description: desc, images: [PREVIEW_IMAGE.url] },
  };
}
