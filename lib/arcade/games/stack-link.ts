/**
 * Stack link: map three fictional fields through four stages, CRM to service
 * platform. Fixed data and a pure reducer, so the same choices always give the
 * same result. Fictional field names only. See docs/arcade-game-rules.md.
 */

export const LANES = ["CRM", "Middleware", "ERP", "Service platform"] as const;
export type LaneIndex = 0 | 1 | 2 | 3;
export const PROPOSED_LABEL = "Proposed integration. POC under evaluation. Fictional data.";

export type FieldId = "customer_id" | "credit_limit" | "billing_email";
export type Option = { name: string; type: string; ok: boolean };

/** Each field, with two candidate target fields per stage: one matches its meaning and type. Fictional. */
export const FIELDS: { id: FieldId; spec: string; options: [Option, Option][] }[] = [
  {
    id: "customer_id",
    spec: "customer_id, text, required",
    options: [
      [
        { name: "account_ref", type: "text, required", ok: true },
        { name: "account_no", type: "number, optional", ok: false },
      ],
      [
        { name: "party_seq", type: "number", ok: false },
        { name: "party_key", type: "text, required", ok: true },
      ],
      [
        { name: "partner_code", type: "text, required", ok: true },
        { name: "partner_flag", type: "yes/no", ok: false },
      ],
      [
        { name: "requester_count", type: "number", ok: false },
        { name: "requester_ref", type: "text, required", ok: true },
      ],
    ],
  },
  {
    id: "credit_limit",
    spec: "credit_limit, decimal, currency",
    options: [
      [
        { name: "credit_note", type: "text", ok: false },
        { name: "credit_cap", type: "decimal, currency", ok: true },
      ],
      [
        { name: "limit_amount", type: "decimal, currency", ok: true },
        { name: "limit_amount_text", type: "text", ok: false },
      ],
      [
        { name: "exposure_max", type: "decimal, currency", ok: true },
        { name: "exposure_days", type: "whole number", ok: false },
      ],
      [
        { name: "spend_ceiling", type: "decimal, currency", ok: true },
        { name: "spend_category", type: "text", ok: false },
      ],
    ],
  },
  {
    id: "billing_email",
    spec: "billing_email, email, optional",
    options: [
      [
        { name: "invoice_contact", type: "email, optional", ok: true },
        { name: "invoice_contact_name", type: "text", ok: false },
      ],
      [
        { name: "notify_channel", type: "text, required", ok: false },
        { name: "notify_address", type: "email, optional", ok: true },
      ],
      [
        { name: "bill_to_email", type: "email, optional", ok: true },
        { name: "bill_to_phone", type: "phone", ok: false },
      ],
      [
        { name: "contact_email", type: "email, optional", ok: true },
        { name: "contact_opt_in", type: "yes/no", ok: false },
      ],
    ],
  },
];
export const fieldSpec = (id: FieldId) => FIELDS.find((f) => f.id === id)!.spec;

export type Card =
  | { kind: "field"; key: string; field: FieldId; broken?: string }
  | { kind: "validation"; key: string }
  | { kind: "connector"; key: string; lane: 1 | 3 };

/** The deck, in falling order. Fixed. */
export const DECK: Card[] = [
  { kind: "field", key: "c01", field: "customer_id" },
  { kind: "connector", key: "c02", lane: 1 },
  { kind: "field", key: "c03", field: "customer_id" },
  { kind: "field", key: "c04", field: "credit_limit" },
  { kind: "validation", key: "c05" },
  { kind: "field", key: "c06", field: "credit_limit", broken: "12 records missing a currency" },
  { kind: "field", key: "c07", field: "customer_id" },
  { kind: "field", key: "c08", field: "billing_email" },
  { kind: "connector", key: "c09", lane: 3 },
  { kind: "field", key: "c10", field: "credit_limit" },
  { kind: "validation", key: "c11" },
  { kind: "field", key: "c12", field: "billing_email", broken: "40 addresses fail the email format" },
  { kind: "field", key: "c13", field: "customer_id" },
  { kind: "field", key: "c14", field: "billing_email" },
  { kind: "validation", key: "c15" },
  { kind: "field", key: "c16", field: "credit_limit", broken: "3 limits are negative" },
  { kind: "field", key: "c17", field: "billing_email" },
];

/** Real milliseconds for a card to fall. Relaxed mode never drops it on its own. */
export const FALL_MS = 9000;

export const POINTS = {
  stageMapped: 3,
  validatedBroken: 3,
  chainComplete: 10,
  /** Exceptions are subtracted. */
  exceptionWrongMapping: 2,
  exceptionUnvalidated: 4,
} as const;

// --- State ----------------------------------------------------------------------------------------------

export type StackState = {
  queue: Card[];
  /** Cards already parked once (a second park drops them). */
  retried: string[];
  active: Card | null;
  lane: LaneIndex;
  /** A field placed in a lane, waiting for the mapping choice. */
  pending: { card: Extract<Card, { kind: "field" }>; lane: LaneIndex } | null;
  mapped: Record<FieldId, boolean[]>;
  connectors: { 1: boolean; 3: boolean };
  validations: number;
  validatedBroken: number;
  exceptions: number;
  dropped: number;
  done: boolean;
  note: string;
};

export function initialStack(): StackState {
  return next({
    queue: DECK,
    retried: [],
    active: null,
    lane: 0,
    pending: null,
    mapped: { customer_id: [false, false, false, false], credit_limit: [false, false, false, false], billing_email: [false, false, false, false] },
    connectors: { 1: false, 3: false },
    validations: 0,
    validatedBroken: 0,
    exceptions: 0,
    dropped: 0,
    done: false,
    note: "",
  });
}

function next(s: StackState): StackState {
  if (!s.queue.length) return { ...s, active: null, done: true };
  const [card, ...queue] = s.queue;
  return { ...s, active: card, queue, lane: 0 };
}

/** Why a card can't go into a lane yet (null if it can). */
export function blockedReason(s: StackState, card: Card, lane: LaneIndex): string | null {
  if (card.kind === "validation") return null;
  if (card.kind === "connector") return card.lane === lane ? null : `This connector belongs in the ${LANES[card.lane]} lane`;
  if (s.mapped[card.field][lane]) return `${card.field} is already mapped in ${LANES[lane]}`;
  if ((lane === 1 || lane === 3) && !s.connectors[lane]) return `${LANES[lane]} has no connector yet`;
  if (lane > 0 && !s.mapped[card.field][lane - 1]) return `${LANES[lane - 1]} isn't mapped for ${card.field} yet, so ${LANES[lane]} can't connect`;
  return null;
}

/** A blocked card is parked to the end of the queue once; the second time it's set aside. */
function park(s: StackState, card: Card, why: string): StackState {
  if (s.retried.includes(card.key)) return next({ ...s, dropped: s.dropped + 1, note: `${why}. The card is set aside.` });
  return next({ ...s, queue: [...s.queue, card], retried: [...s.retried, card.key], note: `${why}. The card is parked and comes back later.` });
}

export type StackAction =
  | { type: "move"; dir: -1 | 1 }
  | { type: "place"; lane?: LaneIndex }
  | { type: "choose"; option: 0 | 1 }
  /** The fall timer ran out: place it in the lane it's over. */
  | { type: "timeout" };

export function stackReducer(s: StackState, a: StackAction): StackState {
  if (s.done) return s;
  if (a.type === "choose") {
    if (!s.pending) return s;
    const { card, lane } = s.pending;
    const field = FIELDS.find((f) => f.id === card.field)!;
    const opt = field.options[lane][a.option];
    let st: StackState = { ...s, pending: null };
    let note: string;
    // Broken data uses a validation if one is ready; otherwise it maps with exceptions.
    let dataNote = "";
    if (card.broken) {
      if (st.validations > 0) {
        st = { ...st, validations: st.validations - 1, validatedBroken: st.validatedBroken + 1 };
        dataNote = ` Validation fixed it first: ${card.broken}.`;
      } else {
        st = { ...st, exceptions: st.exceptions + POINTS.exceptionUnvalidated };
        dataNote = ` No validation was ready, so ${card.broken} became exceptions.`;
      }
    }
    if (opt.ok) {
      const mapped = { ...st.mapped, [card.field]: st.mapped[card.field].map((v, i) => (i === lane ? true : v)) };
      const chain = mapped[card.field].every(Boolean);
      st = { ...st, mapped };
      note = `${card.field} → ${opt.name} (${opt.type}) in ${LANES[lane]}.${lane > 0 ? ` ${LANES[lane - 1]} to ${LANES[lane]} connected.` : ""}${chain ? ` Full chain for ${card.field}: combo bonus.` : ""}`;
    } else {
      st = { ...st, exceptions: st.exceptions + POINTS.exceptionWrongMapping };
      note = `${card.field} → ${opt.name} (${opt.type}) doesn't match its meaning and type, so records fail downstream. No connection.`;
      // The field can come back once for another try.
      if (!st.retried.includes(card.key)) st = { ...st, queue: [...st.queue, card], retried: [...st.retried, card.key] };
    }
    return next({ ...st, note: note + dataNote });
  }
  if (!s.active || s.pending) return s;
  const card = s.active;
  switch (a.type) {
    case "move": {
      const lane = Math.max(0, Math.min(3, s.lane + a.dir)) as LaneIndex;
      return { ...s, lane };
    }
    case "place":
    case "timeout": {
      const lane = (a.type === "place" && a.lane !== undefined ? a.lane : s.lane) as LaneIndex;
      if (card.kind === "validation") return next({ ...s, validations: s.validations + 1, note: "Validation card ready: the next broken data card will be checked first." });
      const blocked = blockedReason(s, card, lane);
      if (blocked) return park({ ...s, lane }, card, blocked);
      if (card.kind === "connector") {
        return next({ ...s, connectors: { ...s.connectors, [card.lane]: true }, note: `${LANES[card.lane]} connector in place.` });
      }
      return { ...s, lane, pending: { card, lane }, note: `Map ${card.field} in ${LANES[lane]}: choose the matching field.` };
    }
  }
}

export type StackSummary = {
  score: number;
  maxScore: number;
  mappedStages: number;
  totalStages: number;
  segments: number;
  chains: number;
  validatedBroken: number;
  exceptions: number;
};

export function summariseStack(s: StackState): StackSummary {
  const all = Object.values(s.mapped);
  const mappedStages = all.reduce((n, m) => n + m.filter(Boolean).length, 0);
  const segments = all.reduce((n, m) => n + m.slice(1).filter((v, i) => v && m[i]).length, 0);
  const chains = all.filter((m) => m.every(Boolean)).length;
  const brokenCards = DECK.filter((c) => c.kind === "field" && c.broken).length;
  const score = mappedStages * POINTS.stageMapped + s.validatedBroken * POINTS.validatedBroken + chains * POINTS.chainComplete - s.exceptions;
  const maxScore = FIELDS.length * LANES.length * POINTS.stageMapped + brokenCards * POINTS.validatedBroken + FIELDS.length * POINTS.chainComplete;
  return { score, maxScore, mappedStages, totalStages: FIELDS.length * LANES.length, segments, chains, validatedBroken: s.validatedBroken, exceptions: s.exceptions };
}
