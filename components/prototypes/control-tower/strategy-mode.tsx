"use client";

import { useEffect, useRef, useState } from "react";
import { StatusPill } from "@/components/ui/status-pill";
import { streamChat } from "@/lib/rag/client";
import { RISK_LABEL, RISK_STATUS, inr, type M2Choice } from "./model";
import { dotClass } from "@/components/prototypes/engine/status";
import {
  ACTIONS,
  CONDITION_KINDS,
  DEFAULT_CONDITION,
  LOCAL_TRUCK_KL,
  PRIORITIES,
  UTILISATION_THRESHOLDS,
  consolidation,
  describeRule,
  ruleMatches,
  shipmentRisk,
  soloUtilisation,
  type Candidate,
  type Condition,
  type ConditionKind,
  type DispatcherState,
  type PolicyAction,
  type QueuedShipment,
  type Rule,
  type RuleEffect,
} from "./strategy";

export const DEFAULT_RULE: Rule = { when: DEFAULT_CONDITION.priority, and: null, then: "expedite" };

const selectClass = "h-9 max-w-full rounded-md border border-rule bg-ink px-2 text-sm text-text";

/**
 * Strategy Mode (unlocked after Mission 02): the afternoon queue, a control
 * policy of one or two WHEN / AND / THEN rules, and the AI Dispatcher Copilot.
 */
export function StrategyMode({
  queue,
  m2,
  rules,
  onRulesChange,
  policy,
  onActivate,
  onRevise,
  dispatcherState,
  consolidatedCount,
  onApprove,
  onReject,
}: {
  queue: QueuedShipment[];
  m2: M2Choice | null;
  rules: Rule[];
  onRulesChange: (rules: Rule[]) => void;
  policy: RuleEffect[] | null;
  onActivate: () => void;
  onRevise: () => void;
  dispatcherState: DispatcherState;
  consolidatedCount: number;
  onApprove: (c: Candidate) => void;
  onReject: (c: Candidate) => void;
}) {
  const shownRules = policy ? policy.map((e) => e.rule) : rules;
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-dim">
        The morning fires are out. Set a standing control policy for the afternoon queue, and let the AI Dispatcher look for runs to combine.
      </p>
      <Queue queue={queue} m2={m2} rules={shownRules} consolidatedCount={consolidatedCount} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        {policy ? (
          <ActivePolicy policy={policy} onRevise={onRevise} />
        ) : (
          <RuleBuilder rules={rules} onChange={onRulesChange} queue={queue} m2={m2} onActivate={onActivate} />
        )}
        <Copilot state={dispatcherState} onApprove={onApprove} onReject={onReject} />
      </div>
    </div>
  );
}

// --- Queue -------------------------------------------------------------------------------------

function Queue({ queue, m2, rules, consolidatedCount }: { queue: QueuedShipment[]; m2: M2Choice | null; rules: Rule[]; consolidatedCount: number }) {
  const matchesOf = (q: QueuedShipment) => rules.flatMap((r, i) => (ruleMatches(r, [q], m2).length ? [`R${i + 1}`] : []));
  return (
    <section aria-labelledby="queue-title" className="rounded-lg border border-rule bg-panel p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h4 id="queue-title" className="font-mono text-xs uppercase tracking-wider text-text-faint">
          Afternoon queue · {queue.length} shipments
        </h4>
        {consolidatedCount > 0 && <span className="text-xs text-text-faint">{consolidatedCount} consolidated off the queue</span>}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="text-xs text-text-faint">
            <tr>
              <th scope="col" className="py-1 pr-3 font-normal">Shipment</th>
              <th scope="col" className="py-1 pr-3 font-normal">Customer</th>
              <th scope="col" className="py-1 pr-3 font-normal">Depot</th>
              <th scope="col" className="py-1 pr-3 text-right font-normal">KL</th>
              <th scope="col" className="py-1 pr-3 font-normal">Priority</th>
              <th scope="col" className="py-1 pr-3 text-right font-normal">SLA</th>
              <th scope="col" className="py-1 pr-3 text-right font-normal">Truck use</th>
              <th scope="col" className="py-1 pr-3 font-normal">Route risk</th>
              <th scope="col" className="py-1 font-normal">Policy</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((q) => {
              const risk = shipmentRisk(q, m2);
              const matches = matchesOf(q);
              return (
                <tr key={q.id} className="border-t border-rule">
                  <td className="py-1.5 pr-3 font-mono tabular-nums text-text">#{q.id}</td>
                  <td className="py-1.5 pr-3 text-text-dim">{q.customer}</td>
                  <td className="py-1.5 pr-3 font-mono text-text-dim">{q.depot}</td>
                  <td className="py-1.5 pr-3 text-right font-mono tabular-nums text-text-dim">{q.demand}</td>
                  <td className={`py-1.5 pr-3 ${q.priority === "Critical" ? "text-signal-red" : q.priority === "High" ? "text-signal-amber" : "text-text-dim"}`}>
                    {q.priority}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono tabular-nums text-text-dim">{q.slaHours} h</td>
                  <td className="py-1.5 pr-3 text-right font-mono tabular-nums text-text-dim">{soloUtilisation(q)}%</td>
                  <td className="py-1.5 pr-3">
                    <span className="flex items-center gap-1.5 text-text-dim">
                      <span aria-hidden className={dotClass(RISK_STATUS[risk])} />
                      {RISK_LABEL[risk]}
                    </span>
                  </td>
                  <td className="py-1.5 font-mono text-xs text-signal-blue">{matches.join(" ") || <span className="text-text-faint">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-text-faint">Truck use: the share of a {LOCAL_TRUCK_KL} KL local truck the shipment fills on its own.</p>
    </section>
  );
}

// --- Rule builder ------------------------------------------------------------------------------

function RuleBuilder({
  rules,
  onChange,
  queue,
  m2,
  onActivate,
}: {
  rules: Rule[];
  onChange: (rules: Rule[]) => void;
  queue: QueuedShipment[];
  m2: M2Choice | null;
  onActivate: () => void;
}) {
  const update = (i: number, r: Rule) => onChange(rules.map((x, j) => (j === i ? r : x)));
  return (
    <section aria-labelledby="rules-title" className="rounded-lg border border-rule bg-panel p-4">
      <h4 id="rules-title" className="text-base">
        Automation rules
      </h4>
      <p className="mt-1 text-xs text-text-faint">Build one or two rules, then activate them as the control policy.</p>
      <div className="mt-3 space-y-3">
        {rules.map((r, i) => {
          const matched = ruleMatches(r, queue, m2);
          return (
            <fieldset key={i} className="min-w-0 rounded-md border border-rule bg-ink p-3">
              <legend className="px-1 font-mono text-xs text-text-faint">Rule {i + 1}</legend>
              <div className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-2 gap-y-2">
                <span className="font-mono text-xs text-text-faint">WHEN</span>
                <ConditionPicker label={`Rule ${i + 1} condition`} value={r.when} onChange={(when) => when && update(i, { ...r, when, and: r.and?.kind === when.kind ? null : r.and })} />
                <span className="font-mono text-xs text-text-faint">AND</span>
                <ConditionPicker
                  label={`Rule ${i + 1} second condition`}
                  value={r.and}
                  exclude={r.when.kind}
                  optional
                  onChange={(and) => update(i, { ...r, and })}
                />
                <span className="font-mono text-xs text-text-faint">THEN</span>
                <select
                  aria-label={`Rule ${i + 1} action`}
                  value={r.then}
                  onChange={(e) => update(i, { ...r, then: e.target.value as PolicyAction })}
                  className={selectClass}
                >
                  {(Object.keys(ACTIONS) as PolicyAction[]).map((a) => (
                    <option key={a} value={a}>
                      {ACTIONS[a].label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-2 text-xs text-text-faint">{ACTIONS[r.then].note}.</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p aria-live="polite" className="text-xs text-text-dim">
                  {matched.length ? `Matches now: ${matched.map((q) => `#${q.id}`).join(", ")}` : "No shipment matches right now."}
                </p>
                {rules.length > 1 && (
                  <button type="button" onClick={() => onChange(rules.filter((_, j) => j !== i))} className="text-xs text-text-dim underline decoration-rule underline-offset-4 hover:text-text">
                    Remove rule {i + 1}
                  </button>
                )}
              </div>
            </fieldset>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onActivate} className="h-10 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90">
          Activate control policy
        </button>
        {rules.length < 2 && (
          <button
            type="button"
            onClick={() => onChange([...rules, { when: DEFAULT_CONDITION.utilisation, and: null, then: "consolidate" }])}
            className="h-10 rounded-md border border-rule px-4 text-sm text-text transition-colors hover:bg-panel-2"
          >
            Add a second rule
          </button>
        )}
      </div>
    </section>
  );
}

/** A condition: its type, then its value. `optional` adds "none" (for the AND slot). */
function ConditionPicker({
  label,
  value,
  onChange,
  exclude,
  optional,
}: {
  label: string;
  value: Condition | null;
  onChange: (c: Condition | null) => void;
  exclude?: ConditionKind;
  optional?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <select
        aria-label={`${label} type`}
        value={value?.kind ?? ""}
        onChange={(e) => onChange(e.target.value ? DEFAULT_CONDITION[e.target.value as ConditionKind] : null)}
        className={selectClass}
      >
        {optional && <option value="">None (optional)</option>}
        {CONDITION_KINDS.filter((k) => k.kind !== exclude).map((k) => (
          <option key={k.kind} value={k.kind}>
            {k.label}
          </option>
        ))}
      </select>
      {value?.kind === "priority" && (
        <select aria-label={`${label} value`} value={value.value} onChange={(e) => onChange({ kind: "priority", value: e.target.value as typeof value.value })} className={selectClass}>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              = {p}
            </option>
          ))}
        </select>
      )}
      {value?.kind === "utilisation" && (
        <select aria-label={`${label} value`} value={value.below} onChange={(e) => onChange({ kind: "utilisation", below: Number(e.target.value) })} className={selectClass}>
          {UTILISATION_THRESHOLDS.map((t) => (
            <option key={t} value={t}>
              &lt; {t}%
            </option>
          ))}
        </select>
      )}
      {value?.kind === "route-risk" && (
        <select
          aria-label={`${label} value`}
          value={value.atLeast}
          onChange={(e) => onChange({ kind: "route-risk", atLeast: e.target.value as typeof value.atLeast })}
          className={selectClass}
        >
          <option value="at-risk">≥ At risk</option>
          <option value="critical">≥ Critical</option>
        </select>
      )}
    </div>
  );
}

function ActivePolicy({ policy, onRevise }: { policy: RuleEffect[]; onRevise: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <section aria-labelledby="policy-title" className="rounded-lg border border-signal-teal bg-panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 id="policy-title" ref={headingRef} tabIndex={-1} className="text-base">
          Control policy
        </h4>
        <StatusPill tone="live">Active</StatusPill>
      </div>
      <ol className="mt-3 space-y-3">
        {policy.map((e, i) => (
          <li key={i} className="rounded-md border border-rule bg-ink p-3">
            <p className="font-mono text-xs text-text">{describeRule(e.rule)}</p>
            <p className="mt-1.5 text-sm text-text-dim">{e.summary}</p>
          </li>
        ))}
      </ol>
      <button type="button" onClick={onRevise} className="mt-4 h-9 rounded-md border border-rule px-3 text-sm text-text transition-colors hover:bg-panel-2">
        Revise policy
      </button>
      <p className="mt-2 text-xs text-text-faint">Revising switches the policy off and undoes its effects until you activate it again.</p>
    </section>
  );
}

// --- AI Dispatcher Copilot ----------------------------------------------------------------------

const PROTOTYPE_SLUG = "control-tower-24";
const COPILOT_FALLBACK = "The copilot isn't available right now. The queue and your policy still work without it.";

type Proposal = { candidate: Candidate; reasoning: string };

/**
 * Asks the same AI setup as Ask Anshu (/api/chat, dispatcher mode) for one
 * consolidation from the current queue. The reasoning is the model's; the
 * figures shown and applied come from the tower's own candidate.
 */
function Copilot({ state, onApprove, onReject }: { state: DispatcherState; onApprove: (c: Candidate) => void; onReject: (c: Candidate) => void }) {
  const [status, setStatus] = useState<"idle" | "loading" | "proposal" | "failed">("idle");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const { candidates } = consolidation(state);

  async function analyze() {
    if (status === "loading" || !candidates.length) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setStatus("loading");
    setProposal(null);
    setOutcome(null);
    setError(null);
    let result: Proposal | null = null;
    try {
      await streamChat(
        { dispatcher: { prototype: PROTOTYPE_SLUG, state } },
        (e) => {
          if (e.type !== "proposal") return;
          const candidate = candidates.find((c) => c.id === e.candidate);
          if (candidate) result = { candidate, reasoning: e.reasoning };
        },
        controller.signal
      );
      if (!result) throw new Error("No proposal");
      setProposal(result);
      setStatus("proposal");
    } catch (err) {
      if (controller.signal.aborted) return;
      // Input problems (e.g. the rate limit) are worth showing as is; anything else gets the quiet fallback.
      const message = err instanceof Error ? err.message : "";
      setError(/limit|try again/i.test(message) ? message : null);
      setStatus("failed");
    }
  }

  const decide = (approve: boolean) => {
    if (!proposal) return;
    const c = proposal.candidate;
    (approve ? onApprove : onReject)(c);
    setOutcome(
      approve
        ? `Approved: #${c.a.id} and #${c.b.id} now share one ${c.depot} run. ${inr.format(c.saving)} saved and a truck freed.`
        : `Rejected: #${c.a.id} and #${c.b.id} keep their own runs. No change.`
    );
    setProposal(null);
    setStatus("idle");
  };

  return (
    <section aria-labelledby="copilot-title" className="rounded-lg border border-rule bg-panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 id="copilot-title" className="text-base">
          AI Dispatcher Copilot
        </h4>
        <StatusPill tone="idle">AI</StatusPill>
      </div>
      <p className="mt-1 text-xs text-text-faint">Reads the live queue and your policy, and proposes one consolidation.</p>

      <div aria-live="polite" aria-busy={status === "loading"} className="mt-3 space-y-3">
        {outcome && <p className="text-sm text-text">{outcome}</p>}

        {status === "loading" && (
          <div className="rounded-md border border-rule bg-ink p-3">
            <p className="text-sm text-text-dim">Analyzing the queue and your policy…</p>
            <div aria-hidden className="mt-2 space-y-2">
              <div className="h-3 w-5/6 animate-pulse rounded bg-panel-2 motion-reduce:animate-none" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-panel-2 motion-reduce:animate-none" />
            </div>
          </div>
        )}

        {status === "proposal" && proposal && (
          <div className="rounded-md border border-signal-blue bg-ink p-3">
            <p className="text-sm font-medium text-text">
              Consolidate #{proposal.candidate.a.id} + #{proposal.candidate.b.id}
            </p>
            <p className="mt-1.5 text-sm text-text-dim">{proposal.reasoning}</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-text-faint">Depot</dt>
                <dd className="font-mono text-text">{proposal.candidate.depot}</dd>
              </div>
              <div>
                <dt className="text-text-faint">Load</dt>
                <dd className="font-mono tabular-nums text-text">
                  {proposal.candidate.load}/{LOCAL_TRUCK_KL} KL
                </dd>
              </div>
              <div>
                <dt className="text-text-faint">Saving</dt>
                <dd className="font-mono tabular-nums text-signal-teal">{inr.format(proposal.candidate.saving)}</dd>
              </div>
            </dl>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => decide(true)} className="h-9 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90">
                Approve
              </button>
              <button type="button" onClick={() => decide(false)} className="h-9 rounded-md border border-rule px-4 text-sm text-text transition-colors hover:bg-panel-2">
                Reject
              </button>
            </div>
            <p className="mt-2 text-xs text-text-faint">AI suggestion from the current queue; it can be wrong. The figures come from the tower.</p>
          </div>
        )}

        {status === "failed" && <p className="text-sm text-text-dim">{error ?? COPILOT_FALLBACK}</p>}

        {status !== "loading" && status !== "proposal" &&
          (candidates.length ? (
            <button type="button" onClick={analyze} className="h-9 rounded-md border border-rule px-4 text-sm text-text transition-colors hover:bg-panel-2">
              {status === "failed" ? "Try again" : outcome ? "Analyze again" : "Analyze the queue"}
            </button>
          ) : (
            <p className="text-sm text-text-dim">No consolidation opportunities left in the queue.</p>
          ))}
      </div>
    </section>
  );
}
