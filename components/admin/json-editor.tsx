"use client";

import { useRef, useState } from "react";
import type { JsonLeaf, JsonNestedList, JsonSpec } from "@/lib/admin/entities";
import { inputClass, secondaryButtonClass } from "./styles";

type Item = Record<string, unknown>;

function isObject(v: unknown): v is Item {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Structured editor for a JSONB column. Serializes its state into a hidden
 * input named `name`; the server cleans and validates it (lib/admin/parse.ts).
 */
export function JsonEditor({ name, spec, defaultValue }: { name: string; spec: JsonSpec; defaultValue: unknown }) {
  const [value, setValue] = useState<unknown>(() =>
    spec.kind === "list" ? (Array.isArray(defaultValue) ? defaultValue : []) : isObject(defaultValue) ? defaultValue : {}
  );

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(value)} />
      {spec.kind === "list" ? (
        <ListEditor items={value as Item[]} onChange={setValue} fields={spec.fields} itemLabel={spec.itemLabel} />
      ) : (
        <ObjectEditor value={value as Item} onChange={setValue} fields={spec.fields} />
      )}
    </div>
  );
}

function ObjectEditor({
  value,
  onChange,
  fields,
}: {
  value: Item;
  onChange: (v: Item) => void;
  fields: (JsonLeaf | JsonNestedList)[];
}) {
  return (
    <div className="space-y-4 rounded-md border border-rule p-4">
      {fields.map((f) =>
        f.type === "list" ? (
          <div key={f.key} className="space-y-2">
            <p className="text-sm font-medium">{f.label}</p>
            <ListEditor
              items={Array.isArray(value[f.key]) ? (value[f.key] as Item[]) : []}
              onChange={(items) => onChange({ ...value, [f.key]: items })}
              fields={f.fields}
              itemLabel={f.itemLabel}
            />
          </div>
        ) : (
          <LeafInput key={f.key} leaf={f} value={value[f.key]} onChange={(v) => onChange({ ...value, [f.key]: v })} />
        )
      )}
    </div>
  );
}

function ListEditor({
  items,
  onChange,
  fields,
  itemLabel,
}: {
  items: Item[];
  onChange: (items: Item[]) => void;
  fields: JsonLeaf[];
  itemLabel: string;
}) {
  // Stable React keys so inputs keep focus/state when items are reordered or removed.
  const nextKey = useRef(items.length);
  const [keys, setKeys] = useState(() => items.map((_, i) => i));

  const add = () => {
    setKeys([...keys, nextKey.current++]);
    onChange([...items, {}]);
  };
  const remove = (i: number) => {
    setKeys(keys.filter((_, j) => j !== i));
    onChange(items.filter((_, j) => j !== i));
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const swap = <T,>(arr: T[]) => {
      const copy = [...arr];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    };
    setKeys(swap(keys));
    onChange(swap(items));
  };
  const update = (i: number, key: string, v: unknown) =>
    onChange(items.map((item, j) => (j === i ? { ...item, [key]: v } : item)));

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={keys[i]} className="rounded-md border border-rule p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-text-dim">
              {itemLabel} {i + 1}
            </span>
            <div className="flex gap-1">
              <button type="button" className={secondaryButtonClass} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${itemLabel} ${i + 1} up`}>
                ↑
              </button>
              <button type="button" className={secondaryButtonClass} onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move ${itemLabel} ${i + 1} down`}>
                ↓
              </button>
              <button type="button" className={secondaryButtonClass} onClick={() => remove(i)}>
                Remove
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <LeafInput key={f.key} leaf={f} value={item[f.key]} onChange={(v) => update(i, f.key, v)} />
            ))}
          </div>
        </div>
      ))}
      <button type="button" className={secondaryButtonClass} onClick={add}>
        + Add {itemLabel.toLowerCase()}
      </button>
    </div>
  );
}

function LeafInput({ leaf, value, onChange }: { leaf: JsonLeaf; value: unknown; onChange: (v: unknown) => void }) {
  const display = value === null || value === undefined ? "" : String(value);
  return (
    <label className={`block space-y-1 ${leaf.type === "textarea" ? "sm:col-span-2" : ""}`}>
      <span className="text-sm">{leaf.label}</span>
      {leaf.type === "textarea" ? (
        <textarea rows={3} className={inputClass} value={display} placeholder={leaf.placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input
          type={leaf.type === "number" ? "number" : "text"}
          inputMode={leaf.type === "url" ? "url" : undefined}
          step={leaf.type === "number" ? "any" : undefined}
          className={inputClass}
          value={display}
          placeholder={leaf.placeholder}
          onChange={(e) => onChange(leaf.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
        />
      )}
    </label>
  );
}
