// Seeds portfolio content from data/seed/portfolio.json into Supabase.
//
//   npm run seed
//
// Idempotent: work and skills are matched by slug, certifications by name,
// achievements by title, and the profile is the single row id = 1. Re-running
// overwrites those rows with the JSON (edits made in /admin to the same fields
// are replaced), and never duplicates them. Rows not in the JSON are left alone.
// Uses the service role key from .env.local, so it bypasses RLS: server-side only.
import { readFileSync } from "node:fs";

const env = { ...process.env };
for (const line of readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && !env[m[1]]) env[m[1]] = m[2];
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");

const data = JSON.parse(readFileSync(new URL("./portfolio.json", import.meta.url), "utf8"));

async function rest(method, path, body, prefer = "return=representation") {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: prefer },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}
const upsert = (table, rows, onConflict) =>
  rest("POST", `${table}?on_conflict=${onConflict}`, rows, "return=representation,resolution=merge-duplicates");
const inList = (values) => `(${values.map((v) => `"${String(v).replace(/"/g, '\\"')}"`).join(",")})`;

/** Upsert by a non-unique natural key (name/title): update matches, insert the rest. */
async function upsertBy(table, column, rows) {
  const existing = await rest("GET", `${table}?select=id,${column}&${column}=in.${inList(rows.map((r) => r[column]))}`);
  const ids = new Map(existing.map((r) => [r[column], r.id]));
  const out = [];
  for (const row of rows) {
    const id = ids.get(row[column]);
    const saved = id ? await rest("PATCH", `${table}?id=eq.${id}`, row) : await rest("POST", table, row);
    out.push(saved[0]);
  }
  return out;
}

// --- Profile -----------------------------------------------------------------------
await upsert("profile", [{ id: 1, ...data.profile }], "id");
console.log("profile: saved");

// --- Skills ------------------------------------------------------------------------
const skills = await upsert(
  "skills",
  data.skills.map((s, i) => ({
    name: s.name,
    slug: s.slug,
    category: s.category,
    description: s.description ?? null,
    icon: s.icon ?? null,
    featured: !!s.featured,
    display_order: i, // JSON order; categories sort by their first skill
  })),
  "slug"
);
const skillId = new Map(skills.map((s) => [s.slug, s.id]));
console.log(`skills: ${skills.length} saved`);

const skillIds = (slugs, where) =>
  slugs.map((slug) => {
    const id = skillId.get(slug);
    if (!id) throw new Error(`Unknown skill "${slug}" in ${where}`);
    return id;
  });

// --- Work --------------------------------------------------------------------------
const work = await upsert(
  "work",
  data.work.map((w, i) => ({
    slug: w.slug,
    title: w.title,
    subtitle: w.subtitle ?? null,
    category: w.category ?? null,
    company: w.company ?? null,
    year: w.year ?? null,
    summary: w.summary ?? null,
    problem: w.problem ?? null,
    users: w.users ?? null,
    role: w.role ?? null,
    approach: w.approach ?? null,
    decisions: w.decisions ?? [],
    outcome: w.outcome ?? null,
    metrics: w.metrics ?? [],
    architecture: w.architecture ?? {},
    featured: !!w.featured,
    published: w.published ?? true,
    display_order: i + 1,
  })),
  "slug"
);
const workId = new Map(work.map((w) => [w.slug, w.id]));
await rest("DELETE", `work_skills?work_id=in.${inList(work.map((w) => w.id))}`);
const workLinks = data.work.flatMap((w) => skillIds(w.skills ?? [], `work "${w.slug}"`).map((skill_id) => ({ work_id: workId.get(w.slug), skill_id })));
if (workLinks.length) await rest("POST", "work_skills", workLinks, "return=minimal");
console.log(`work: ${work.length} saved, ${workLinks.length} skill links`);

// --- Certifications ------------------------------------------------------------------
const certs = await upsertBy(
  "certifications",
  "name",
  data.certifications.map((c, i) => ({
    name: c.name,
    issuer: c.issuer,
    description: c.description ?? null,
    issue_date: c.issue_date ?? null,
    expiry_date: c.expiry_date ?? null,
    credential_id: c.credential_id ?? null,
    credential_url: c.credential_url ?? null,
    certificate_image_url: c.certificate_image_url ?? null,
    featured: !!c.featured,
    status: c.status ?? "active",
    display_order: i + 1,
  }))
);
const certId = new Map(certs.map((c) => [c.name, c.id]));
await rest("DELETE", `certification_skills?certification_id=in.${inList(certs.map((c) => c.id))}`);
const certLinks = data.certifications.flatMap((c) =>
  skillIds(c.skills ?? [], `certification "${c.name}"`).map((skill_id) => ({ certification_id: certId.get(c.name), skill_id }))
);
if (certLinks.length) await rest("POST", "certification_skills", certLinks, "return=minimal");
console.log(`certifications: ${certs.length} saved, ${certLinks.length} skill links`);

// --- Achievements --------------------------------------------------------------------
const achievements = await upsertBy(
  "achievements",
  "title",
  data.achievements.map((a, i) => {
    if (a.work && !workId.has(a.work)) throw new Error(`Unknown work "${a.work}" in achievement "${a.title}"`);
    return {
      title: a.title,
      description: a.description ?? null,
      metric_value: a.metric_value ?? null,
      metric_unit: a.metric_unit ?? null,
      metric_context: a.metric_context ?? null,
      category: a.category ?? null,
      date: a.date ?? null,
      work_id: a.work ? workId.get(a.work) : null,
      featured: !!a.featured,
      display_order: i + 1,
    };
  })
);
console.log(`achievements: ${achievements.length} saved`);

console.log("\nDone. Pages refresh on the next save in /admin or within an hour; restart the dev server to see changes now.");
console.log('Then click "Rebuild AI index" in /admin so the AI Lab knows about the new content.');
