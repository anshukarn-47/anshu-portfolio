"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import { saveEntity, type SaveState } from "@/app/admin/(dashboard)/[entity]/actions";
import { getEntity, type EntityKey, type Field, type Row } from "@/lib/admin/entities";
import { JsonEditor } from "./json-editor";
import { errorClass, helpClass, inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "./styles";

export type SkillOption = { id: string; name: string; category: string };
export type WorkOption = { id: string; title: string };

type Props = {
  entityKey: EntityKey;
  id: string | null;
  initial: Row;
  selectedSkillIds: string[];
  skills: SkillOption[];
  works: WorkOption[];
  suggestions: Record<string, string[]>;
};

const initialState: SaveState = { message: null, errors: {} };
const WIDE_TYPES = new Set(["textarea", "markdown", "json", "skills"]);

function SaveButton({ isNew, pending }: { isNew: boolean; pending: boolean }) {
  return (
    <button type="submit" disabled={pending} className={primaryButtonClass}>
      {pending ? "Saving…" : isNew ? "Create" : "Save changes"}
    </button>
  );
}

export function EntityForm({ entityKey, id, initial, selectedSkillIds, skills, works, suggestions }: Props) {
  const config = getEntity(entityKey)!;
  const [result, formAction, pending] = useActionState(saveEntity.bind(null, entityKey, id), initialState);
  // The action always returns a state or redirects, but a response that never arrives
  // (e.g. the server restarted while the page was open) leaves it undefined.
  const state: SaveState = result ?? {
    message: "Couldn't confirm the save. Reload the page to check whether your changes were saved, then try again.",
    errors: {},
  };

  return (
    <form
      action={formAction}
      // React 19 resets a form once its action finishes, which would wipe everything typed
      // whenever a save fails validation. Submitting from onSubmit skips that reset; the
      // action attribute still makes the form work without JavaScript.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="space-y-10"
    >
      {state.message && (
        <p role="alert" className="rounded-md border border-signal-red px-3 py-2 text-sm text-text">
          {state.message}
        </p>
      )}
      {state.savedAt && (
        <p role="status" className="rounded-md border border-signal-teal px-3 py-2 text-sm text-text">
          Saved at {new Date(state.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}.
        </p>
      )}

      {config.sections.map((section) => (
        <fieldset key={section.title} className="space-y-4">
          <div>
            <legend className="text-base font-semibold">{section.title}</legend>
            {section.description && <p className={helpClass}>{section.description}</p>}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {section.fields.map((field) => (
              <div key={field.name} className={WIDE_TYPES.has(field.type) ? "sm:col-span-2" : ""}>
                <FieldInput
                  field={field}
                  value={initial[field.name] ?? field.defaultValue}
                  error={state.errors[field.name]}
                  selectedSkillIds={selectedSkillIds}
                  skills={skills}
                  works={works}
                  suggestions={suggestions[field.name]}
                />
              </div>
            ))}
          </div>
        </fieldset>
      ))}

      <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t border-rule bg-ink px-4 py-4">
        <SaveButton isNew={config.singleton ? Object.keys(initial).length === 0 : !id} pending={pending} />
        <Link href={`/admin/${entityKey}`} className={secondaryButtonClass}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

function FieldInput({
  field,
  value,
  error,
  selectedSkillIds,
  skills,
  works,
  suggestions,
}: {
  field: Field;
  value: unknown;
  error?: string;
  selectedSkillIds: string[];
  skills: SkillOption[];
  works: WorkOption[];
  suggestions?: string[];
}) {
  const id = `field-${field.name}`;
  const str = value === null || value === undefined ? "" : String(value);
  const describedBy = error ? `${id}-error` : field.help ? `${id}-help` : undefined;
  const common = {
    id,
    name: field.name,
    className: inputClass,
    placeholder: field.placeholder,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  };

  const footer = (
    <>
      {field.help && !error && (
        <p id={`${id}-help`} className={helpClass}>
          {field.help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={errorClass}>
          {error}
        </p>
      )}
    </>
  );

  if (field.type === "boolean") {
    return (
      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name={field.name} defaultChecked={Boolean(value)} className="h-4 w-4 accent-[var(--signal-teal)]" />
          {field.label}
        </label>
        {footer}
      </div>
    );
  }

  if (field.type === "skills") {
    return <SkillPicker name={field.name} skills={skills} selected={selectedSkillIds} />;
  }

  let control: React.ReactNode;
  switch (field.type) {
    case "textarea":
      control = <textarea {...common} rows={3} defaultValue={str} required={field.required} />;
      break;
    case "markdown":
      control = <textarea {...common} rows={8} defaultValue={str} className={`${inputClass} font-mono`} />;
      break;
    case "json":
      control = <JsonEditor name={field.name} spec={field.json!} defaultValue={value} />;
      break;
    case "select":
      control = (
        <select {...common} defaultValue={str} required={field.required}>
          {!field.required && <option value="">—</option>}
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    case "work":
      control = (
        <select {...common} defaultValue={str}>
          <option value="">— None —</option>
          {works.map((w) => (
            <option key={w.id} value={w.id}>
              {w.title}
            </option>
          ))}
        </select>
      );
      break;
    case "number":
      control = <input {...common} type="number" step="any" defaultValue={str} />;
      break;
    case "integer":
      control = <input {...common} type="number" step={1} defaultValue={str} />;
      break;
    case "year":
      control = <input {...common} type="number" min={1990} max={2100} step={1} defaultValue={str} />;
      break;
    case "date":
      control = <input {...common} type="date" defaultValue={str} />;
      break;
    case "url":
      control = <input {...common} type="text" inputMode="url" defaultValue={str} />;
      break;
    case "email":
      control = <input {...common} type="email" autoComplete="email" defaultValue={str} />;
      break;
    case "tags":
      control = <input {...common} type="text" autoComplete="off" defaultValue={Array.isArray(value) ? value.join(", ") : str} />;
      break;
    default: // text, slug
      control = (
        <>
          <input
            {...common}
            type="text"
            defaultValue={str}
            required={field.required}
            list={suggestions?.length ? `${id}-list` : undefined}
            autoComplete="off"
          />
          {suggestions?.length ? (
            <datalist id={`${id}-list`}>
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          ) : null}
        </>
      );
  }

  return (
    <div className="space-y-1.5">
      {field.type !== "json" ? (
        <label htmlFor={id} className={labelClass}>
          {field.label}
          {field.required && <span className="text-signal-red"> *</span>}
        </label>
      ) : (
        <p className={labelClass}>{field.label}</p>
      )}
      {control}
      {footer}
    </div>
  );
}

function SkillPicker({ name, skills, selected }: { name: string; skills: SkillOption[]; selected: string[] }) {
  if (!skills.length) {
    return (
      <p className={helpClass}>
        No skills yet.{" "}
        <Link href="/admin/skills/new" className="underline">
          Add skills
        </Link>{" "}
        first, then link them here.
      </p>
    );
  }

  const byCategory = new Map<string, SkillOption[]>();
  for (const s of skills) byCategory.set(s.category, [...(byCategory.get(s.category) ?? []), s]);
  const chosen = new Set(selected);

  return (
    <div className="space-y-4">
      {Array.from(byCategory, ([category, list]) => (
        <div key={category}>
          <p className="mb-2 text-xs font-medium text-text-dim">{category}</p>
          <div className="flex flex-wrap gap-2">
            {list.map((s) => (
              <label
                key={s.id}
                // The checkbox is visually hidden, so the pill carries its keyboard focus ring.
                className="flex cursor-pointer items-center gap-2 rounded-full border border-rule px-3 py-1 text-sm has-[:checked]:border-text has-[:checked]:bg-text has-[:checked]:text-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-signal-teal"
              >
                <input type="checkbox" name={name} value={s.id} defaultChecked={chosen.has(s.id)} className="sr-only" />
                {s.name}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
