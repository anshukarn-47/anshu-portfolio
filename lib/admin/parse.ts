import "server-only";
import { UUID_RE, type EntityConfig, type JsonLeaf, type JsonSpec, type Row } from "./entities";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^(https?:\/\/\S+|\/(?!\/)\S*)$/; // http(s) URL or site path (not protocol-relative "//host")
const HTTP_URL_RE = /^https?:\/\/\S+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type ParseResult = {
  values: Row;
  skillIds: string[] | null; // null = entity has no skills field
  errors: Record<string, string>;
};

/** Converts submitted form data into a validated row for `config.table`. */
export function parseEntityForm(config: EntityConfig, formData: FormData): ParseResult {
  const values: Row = {};
  const errors: Record<string, string> = {};
  let skillIds: string[] | null = null;

  for (const field of config.sections.flatMap((s) => s.fields)) {
    const raw = formData.get(field.name);
    // Browsers submit textarea line breaks as \r\n; store plain \n so paragraph splits and markdown behave the same everywhere.
    let str = typeof raw === "string" ? raw.replace(/\r\n?/g, "\n").trim() : "";

    if (field.type === "boolean") {
      values[field.name] = raw === "on";
      continue;
    }
    if (field.type === "skills") {
      skillIds = formData.getAll(field.name).filter((v): v is string => typeof v === "string" && UUID_RE.test(v));
      continue;
    }
    if (field.type === "json" && field.json) {
      try {
        values[field.name] = cleanJson(field.json, str ? JSON.parse(str) : null);
      } catch {
        errors[field.name] = `${field.label} could not be read. Reload the page and try again.`;
        continue;
      }
      const badUrl = findInvalidUrl(field.json, values[field.name]);
      if (badUrl) errors[field.name] = `${badUrl} must be a full URL starting with https://.`;
      continue;
    }
    if (field.type === "tags") {
      // Comma- or newline-separated; trimmed, de-duplicated (case-insensitive), empty dropped.
      const seen = new Set<string>();
      const tags = str
        .split(/[,\n]/)
        .map((t) => t.trim())
        .filter((t) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()));
      if (tags.length > 30) errors[field.name] = "Use at most 30 tags.";
      else if (tags.some((t) => t.length > 40)) errors[field.name] = "Keep each tag under 40 characters.";
      else if (field.required && !tags.length) errors[field.name] = `${field.label} is required.`;
      values[field.name] = tags;
      continue;
    }
    if (field.type === "slug" && !str && field.slugFrom) {
      str = slugify(String(formData.get(field.slugFrom) ?? ""));
    }

    if (!str) {
      if (field.required) errors[field.name] = `${field.label} is required.`;
      values[field.name] = field.type === "integer" ? Number(field.defaultValue ?? 0) : null;
      continue;
    }

    switch (field.type) {
      case "slug":
        if (!SLUG_RE.test(str)) errors[field.name] = "Use lowercase letters, numbers and single hyphens only.";
        values[field.name] = str;
        break;
      case "url":
        if (field.externalOnly ? !HTTP_URL_RE.test(str) : !URL_RE.test(str)) {
          errors[field.name] = field.externalOnly
            ? "Enter a full URL starting with https://."
            : "Enter a full URL (https://…) or a site path starting with /.";
        }
        values[field.name] = str;
        break;
      case "email":
        if (!EMAIL_RE.test(str)) errors[field.name] = "Enter a valid email address.";
        values[field.name] = str;
        break;
      case "number": {
        const n = Number(str);
        if (!Number.isFinite(n)) errors[field.name] = "Enter a number.";
        values[field.name] = n;
        break;
      }
      case "integer": {
        const n = Number(str);
        if (!Number.isInteger(n)) errors[field.name] = "Enter a whole number.";
        values[field.name] = n;
        break;
      }
      case "year": {
        const n = Number(str);
        if (!Number.isInteger(n) || n < 1990 || n > 2100) errors[field.name] = "Enter a year between 1990 and 2100.";
        values[field.name] = n;
        break;
      }
      case "date":
        if (!DATE_RE.test(str)) errors[field.name] = "Enter a valid date.";
        values[field.name] = str;
        break;
      case "select":
        if (!field.options?.some((o) => o.value === str)) errors[field.name] = "Choose one of the options.";
        values[field.name] = str;
        break;
      case "work":
        if (!UUID_RE.test(str)) errors[field.name] = "Choose a work item.";
        values[field.name] = str;
        break;
      default: // text, textarea, markdown
        values[field.name] = str;
    }
  }

  // Cross-field check (mirrors the certifications_dates_check constraint).
  if (
    typeof values.issue_date === "string" &&
    typeof values.expiry_date === "string" &&
    values.expiry_date < values.issue_date
  ) {
    errors.expiry_date = "Expiry date must be on or after the issue date.";
  }

  return { values, skillIds, errors };
}

// --- JSONB cleaning: coerce types, trim strings, drop empty items/keys ----------

/** Label of the first `url` leaf holding something other than an http(s) URL, or null. */
function findInvalidUrl(spec: JsonSpec, value: unknown): string | null {
  const check = (fields: JsonLeaf[], item: unknown): string | null => {
    if (!item || typeof item !== "object") return null;
    for (const f of fields) {
      const v = (item as Record<string, unknown>)[f.key];
      if (f.type === "url" && typeof v === "string" && !HTTP_URL_RE.test(v)) return f.label;
    }
    return null;
  };
  if (spec.kind === "list") {
    for (const item of Array.isArray(value) ? value : []) {
      const bad = check(spec.fields, item);
      if (bad) return bad;
    }
    return null;
  }
  const leaves = spec.fields.filter((f): f is JsonLeaf => f.type !== "list");
  const bad = check(leaves, value);
  if (bad) return bad;
  for (const f of spec.fields) {
    if (f.type !== "list") continue;
    const items = (value as Record<string, unknown> | null)?.[f.key];
    for (const item of Array.isArray(items) ? items : []) {
      const nested = check(f.fields, item);
      if (nested) return nested;
    }
  }
  return null;
}

function cleanLeaf(leaf: JsonLeaf, v: unknown): string | number | null {
  if (leaf.type === "number") {
    const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  }
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function cleanItem(fields: JsonLeaf[], item: unknown): Record<string, unknown> | null {
  if (!item || typeof item !== "object") return null;
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = cleanLeaf(f, (item as Record<string, unknown>)[f.key]);
    if (v !== null) out[f.key] = v;
  }
  return Object.keys(out).length ? out : null;
}

function cleanList(fields: JsonLeaf[], v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => cleanItem(fields, item)).filter((x): x is Record<string, unknown> => x !== null);
}

function cleanJson(spec: JsonSpec, v: unknown): unknown {
  if (spec.kind === "list") return cleanList(spec.fields, v);

  const src = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const f of spec.fields) {
    if (f.type === "list") {
      const list = cleanList(f.fields, src[f.key]);
      if (list.length) out[f.key] = list;
    } else {
      const leaf = cleanLeaf(f, src[f.key]);
      if (leaf !== null) out[f.key] = leaf;
    }
  }
  return out;
}
