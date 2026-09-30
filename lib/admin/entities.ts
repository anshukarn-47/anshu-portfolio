/**
 * Content types editable from /admin. The list page, form and save/delete
 * actions are generic and driven entirely by this config.
 */

export type EntityKey = "work" | "skills" | "certifications" | "achievements" | "prototypes" | "profile";

// --- JSONB field specs (decisions, metrics, architecture, social links) --------
export type JsonLeaf = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "url"; // url: must be https://…
  placeholder?: string;
};
export type JsonNestedList = { key: string; label: string; type: "list"; itemLabel: string; fields: JsonLeaf[] };
export type JsonSpec =
  | { kind: "list"; itemLabel: string; fields: JsonLeaf[] }
  | { kind: "object"; fields: (JsonLeaf | JsonNestedList)[] };

// --- Form fields ---------------------------------------------------------------
export type FieldType =
  | "text"      // single-line text
  | "slug"      // URL slug, generated from `slugFrom` when left blank
  | "url"       // https://... or /site/path
  | "email"
  | "tags"      // text[]; entered comma-separated
  | "textarea"  // plain multi-line text
  | "markdown"  // multi-line markdown
  | "number"    // decimal
  | "integer"
  | "year"
  | "date"
  | "boolean"
  | "select"
  | "json"      // structured JSONB editor, see `json`
  | "skills"    // skill checkboxes, synced to the entity's join table
  | "work";     // pick a work item (foreign key)

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  help?: string;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  options?: { value: string; label: string }[]; // select
  slugFrom?: string;                            // slug
  suggest?: boolean;                            // text: suggest values already used in this column
  externalOnly?: boolean;                       // url: http(s) only, no site paths
  json?: JsonSpec;                              // json
};

export type Section = { title: string; description?: string; fields: Field[] };

export type Row = Record<string, unknown>;

export type Column = {
  label: string;
  get: (row: Row) => string | null;
  badge?: boolean; // render as a status pill
};

export type EntityConfig = {
  key: EntityKey;
  table: EntityKey;
  label: string;    // plural, e.g. "Certifications"
  singular: string; // e.g. "Certification"
  titleField: string;
  orderBy: { column: string; ascending: boolean }[];
  columns: Column[];
  sections: Section[];
  skillsJoin?: { table: "work_skills" | "certification_skills"; fk: "work_id" | "certification_id" };
  /** Exactly one row (id = SINGLETON_ID). /admin/<key> edits it directly; no list, new or delete. */
  singleton?: boolean;
};

export const SINGLETON_ID = 1;

// --- Shared fields -------------------------------------------------------------
const featured: Field = {
  name: "featured",
  label: "Featured",
  type: "boolean",
  help: "Highlight on the home page.",
};
const displayOrder: Field = {
  name: "display_order",
  label: "Display order",
  type: "integer",
  defaultValue: 0,
  help: "Lower numbers appear first.",
};
const skillsField: Field = {
  name: "skill_ids",
  label: "Skills",
  type: "skills",
};

const str = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

/** Prototype stages, in the order the public page groups them. Values match the DB check constraint. */
export const PROTOTYPE_STAGES = [
  { value: "live", label: "Live" },
  { value: "in_progress", label: "In progress" },
  { value: "concept", label: "Concept" },
  { value: "archived", label: "Archived" },
] as const;

export function stageLabel(stage: unknown): string | null {
  return PROTOTYPE_STAGES.find((s) => s.value === stage)?.label ?? null;
}

// --- Entities ------------------------------------------------------------------
export const entities: Record<EntityKey, EntityConfig> = {
  work: {
    key: "work",
    table: "work",
    label: "Work",
    singular: "Work item",
    titleField: "title",
    orderBy: [
      { column: "display_order", ascending: true },
      { column: "created_at", ascending: false },
    ],
    columns: [
      { label: "Title", get: (r) => str(r.title) },
      { label: "Category", get: (r) => str(r.category) },
      { label: "Year", get: (r) => str(r.year) },
      { label: "Status", get: (r) => (r.published ? "Published" : "Draft"), badge: true },
      { label: "Featured", get: (r) => (r.featured ? "Yes" : null) },
    ],
    sections: [
      {
        title: "Basics",
        fields: [
          { name: "title", label: "Title", type: "text", required: true },
          { name: "slug", label: "Slug", type: "slug", slugFrom: "title", help: "Used in the URL (/work/slug). Leave blank to generate from the title." },
          { name: "subtitle", label: "Subtitle", type: "text" },
          { name: "category", label: "Category", type: "text", suggest: true, placeholder: "e.g. AI, Product Design" },
          { name: "company", label: "Company", type: "text", suggest: true },
          { name: "year", label: "Year", type: "year" },
          { name: "role", label: "Role", type: "text", placeholder: "e.g. Lead Product Engineer" },
          { name: "summary", label: "Summary", type: "textarea", help: "One or two sentences for cards and previews." },
        ],
      },
      {
        title: "Case study",
        description: "Markdown is supported.",
        fields: [
          { name: "problem", label: "Problem", type: "markdown" },
          { name: "users", label: "Users", type: "markdown", help: "Who the work was for." },
          { name: "approach", label: "Approach", type: "markdown" },
          {
            name: "decisions",
            label: "Key decisions",
            type: "json",
            json: {
              kind: "list",
              itemLabel: "Decision",
              fields: [
                { key: "title", label: "Decision", type: "text" },
                { key: "context", label: "Context", type: "textarea" },
                { key: "choice", label: "What we chose", type: "textarea" },
                { key: "tradeoffs", label: "Trade-offs", type: "textarea" },
              ],
            },
          },
          { name: "outcome", label: "Outcome", type: "markdown" },
          {
            name: "metrics",
            label: "Metrics",
            type: "json",
            json: {
              kind: "list",
              itemLabel: "Metric",
              fields: [
                { key: "label", label: "Label", type: "text", placeholder: "Onboarding time" },
                { key: "value", label: "Value", type: "number", placeholder: "40" },
                { key: "unit", label: "Unit", type: "text", placeholder: "%" },
                { key: "context", label: "Context", type: "text", placeholder: "reduction after launch" },
              ],
            },
          },
          {
            name: "architecture",
            label: "Architecture",
            type: "json",
            json: {
              kind: "object",
              fields: [
                { key: "summary", label: "Summary", type: "textarea" },
                { key: "diagram_url", label: "Diagram URL", type: "text", placeholder: "/images/work/diagram.png" },
                {
                  key: "components",
                  label: "Components",
                  type: "list",
                  itemLabel: "Component",
                  fields: [
                    { key: "name", label: "Name", type: "text" },
                    { key: "description", label: "Description", type: "textarea" },
                  ],
                },
              ],
            },
          },
        ],
      },
      { title: "Skills", description: "Skills this work demonstrates.", fields: [skillsField] },
      {
        title: "Publishing",
        fields: [
          { name: "published", label: "Published", type: "boolean", help: "Visible on the public site." },
          featured,
          displayOrder,
        ],
      },
    ],
    skillsJoin: { table: "work_skills", fk: "work_id" },
  },

  skills: {
    key: "skills",
    table: "skills",
    label: "Skills",
    singular: "Skill",
    titleField: "name",
    orderBy: [
      { column: "category", ascending: true },
      { column: "display_order", ascending: true },
      { column: "name", ascending: true },
    ],
    columns: [
      { label: "Name", get: (r) => str(r.name) },
      { label: "Category", get: (r) => str(r.category) },
      { label: "Featured", get: (r) => (r.featured ? "Yes" : null) },
    ],
    sections: [
      {
        title: "Details",
        fields: [
          { name: "name", label: "Name", type: "text", required: true },
          { name: "slug", label: "Slug", type: "slug", slugFrom: "name", help: "Leave blank to generate from the name." },
          { name: "category", label: "Category", type: "text", required: true, suggest: true, placeholder: "e.g. Languages, AI / ML" },
          { name: "icon", label: "Icon", type: "text", help: "Icon name or /images/... path." },
          { name: "description", label: "Description", type: "textarea" },
        ],
      },
      { title: "Publishing", fields: [featured, displayOrder] },
    ],
  },

  certifications: {
    key: "certifications",
    table: "certifications",
    label: "Certifications",
    singular: "Certification",
    titleField: "name",
    orderBy: [
      { column: "display_order", ascending: true },
      { column: "issue_date", ascending: false },
    ],
    columns: [
      { label: "Name", get: (r) => str(r.name) },
      { label: "Issuer", get: (r) => str(r.issuer) },
      { label: "Issued", get: (r) => str(r.issue_date) },
      { label: "Status", get: (r) => str(r.status), badge: true },
    ],
    sections: [
      {
        title: "Details",
        fields: [
          { name: "name", label: "Name", type: "text", required: true },
          { name: "issuer", label: "Issuer", type: "text", required: true, suggest: true },
          { name: "issue_date", label: "Issue date", type: "date" },
          { name: "expiry_date", label: "Expiry date", type: "date", help: "Leave blank if it doesn't expire." },
          { name: "credential_id", label: "Credential ID", type: "text" },
          { name: "credential_url", label: "Verification URL", type: "url", placeholder: "https://" },
          { name: "certificate_image_url", label: "Certificate image", type: "url", help: "Put the file in public/certificates and enter /certificates/file.png." },
          { name: "description", label: "Description", type: "textarea" },
        ],
      },
      { title: "Skills", description: "Skills this certification covers.", fields: [skillsField] },
      {
        title: "Publishing",
        fields: [
          {
            name: "status",
            label: "Status",
            type: "select",
            required: true,
            defaultValue: "active",
            options: [
              { value: "active", label: "Active" },
              { value: "expired", label: "Expired" },
              { value: "hidden", label: "Hidden (not shown publicly)" },
            ],
          },
          featured,
          displayOrder,
        ],
      },
    ],
    skillsJoin: { table: "certification_skills", fk: "certification_id" },
  },

  achievements: {
    key: "achievements",
    table: "achievements",
    label: "Achievements",
    singular: "Achievement",
    titleField: "title",
    orderBy: [
      { column: "display_order", ascending: true },
      { column: "date", ascending: false },
    ],
    columns: [
      { label: "Title", get: (r) => str(r.title) },
      {
        label: "Metric",
        get: (r) => (r.metric_value === null || r.metric_value === undefined ? null : `${r.metric_value}${r.metric_unit ?? ""}`),
      },
      { label: "Category", get: (r) => str(r.category) },
      { label: "Date", get: (r) => str(r.date) },
    ],
    sections: [
      {
        title: "Details",
        fields: [
          { name: "title", label: "Title", type: "text", required: true },
          { name: "category", label: "Category", type: "text", suggest: true, placeholder: "e.g. Impact, Award, Hackathon" },
          { name: "date", label: "Date", type: "date" },
          { name: "work_id", label: "Related work", type: "work", help: "Optional. Links this achievement to a case study." },
          { name: "description", label: "Description", type: "textarea" },
        ],
      },
      {
        title: "Metric",
        description: "Shown as a headline number, e.g. 40% reduction in onboarding time.",
        fields: [
          { name: "metric_value", label: "Value", type: "number", placeholder: "40" },
          { name: "metric_unit", label: "Unit", type: "text", placeholder: "%" },
          { name: "metric_context", label: "Context", type: "text", placeholder: "reduction in onboarding time" },
        ],
      },
      { title: "Publishing", fields: [featured, displayOrder] },
    ],
  },

  prototypes: {
    key: "prototypes",
    table: "prototypes",
    label: "Prototypes",
    singular: "Prototype",
    titleField: "title",
    orderBy: [
      { column: "display_order", ascending: true },
      { column: "created_at", ascending: false },
    ],
    columns: [
      { label: "Title", get: (r) => str(r.title) },
      { label: "Stage", get: (r) => stageLabel(r.stage), badge: true },
      { label: "Status", get: (r) => (r.published ? "Published" : "Draft"), badge: true },
      { label: "Featured", get: (r) => (r.featured ? "Yes" : null) },
    ],
    sections: [
      {
        title: "Basics",
        fields: [
          { name: "title", label: "Title", type: "text", required: true },
          { name: "slug", label: "Slug", type: "slug", slugFrom: "title", help: "Used in the URL (/prototype-lab/slug). Leave blank to generate from the title." },
          {
            name: "stage",
            label: "Stage",
            type: "select",
            required: true,
            defaultValue: "concept",
            options: PROTOTYPE_STAGES.map(({ value, label }) => ({ value, label })),
          },
          { name: "tech_stack", label: "Tech stack", type: "tags", placeholder: "Next.js, Supabase, Claude", help: "Comma-separated." },
          { name: "summary", label: "Summary", type: "textarea", help: "One or two sentences for cards and previews." },
          { name: "description", label: "Description", type: "markdown" },
        ],
      },
      {
        title: "Links & media",
        fields: [
          { name: "demo_url", label: "Demo URL", type: "url", placeholder: "https://", help: "Opens in a new tab." },
          { name: "repo_url", label: "Source code URL", type: "url", externalOnly: true, placeholder: "https://github.com/…" },
          {
            name: "embed_url",
            label: "Embed URL",
            type: "url",
            externalOnly: true,
            placeholder: "https://",
            help: "Optional. Shown in a sandboxed frame on the prototype page. The site must allow embedding.",
          },
          { name: "thumbnail_url", label: "Thumbnail", type: "url", help: "Put the image in public/images and enter /images/prototype.png." },
        ],
      },
      {
        title: "Publishing",
        fields: [
          { name: "published", label: "Published", type: "boolean", help: "Visible on the public site." },
          featured,
          displayOrder,
        ],
      },
    ],
  },

  profile: {
    key: "profile",
    table: "profile",
    label: "Profile",
    singular: "Profile",
    titleField: "full_name",
    singleton: true,
    orderBy: [],
    columns: [],
    sections: [
      {
        title: "About you",
        description: "Shown on the About page.",
        fields: [
          { name: "full_name", label: "Full name", type: "text", required: true },
          { name: "headline", label: "Headline", type: "text", placeholder: "e.g. Product engineer building AI tools" },
          { name: "location", label: "Location", type: "text", placeholder: "e.g. Bengaluru, India" },
          { name: "email", label: "Public email", type: "email", help: "Shown as a contact link. Leave blank to hide." },
          { name: "bio", label: "Bio", type: "markdown" },
        ],
      },
      {
        title: "Files",
        fields: [
          { name: "avatar_url", label: "Photo", type: "url", help: "Put the file in public/images and enter /images/me.jpg." },
          { name: "resume_url", label: "Résumé", type: "url", help: "Put the PDF in public/resume and enter /resume/anshu.pdf." },
        ],
      },
      {
        title: "Links",
        fields: [
          {
            name: "social_links",
            label: "Social links",
            type: "json",
            json: {
              kind: "object",
              fields: [
                { key: "github", label: "GitHub", type: "url", placeholder: "https://github.com/…" },
                { key: "linkedin", label: "LinkedIn", type: "url", placeholder: "https://linkedin.com/in/…" },
                { key: "x", label: "X / Twitter", type: "url", placeholder: "https://x.com/…" },
                { key: "website", label: "Website", type: "url", placeholder: "https://…" },
              ],
            },
          },
        ],
      },
    ],
  },
};

/** Labels for the profile's social_links keys, in display order. */
export const SOCIAL_LINKS = [
  { key: "github", label: "GitHub" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "x", label: "X" },
  { key: "website", label: "Website" },
] as const;

export function getEntity(key: string): EntityConfig | null {
  return Object.prototype.hasOwnProperty.call(entities, key) ? entities[key as EntityKey] : null;
}

export const entityList = Object.values(entities);

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
