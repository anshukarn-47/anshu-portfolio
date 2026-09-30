import { stageLabel } from "@/lib/admin/entities";
import { StatusPill } from "@/components/ui/status-pill";

/** Prototype stage as the site's status pill: only "live" (actually deployed) gets the teal pulse. */
export function StageBadge({ stage }: { stage: string }) {
  const label = stageLabel(stage);
  if (!label) return null;
  return <StatusPill tone={stage === "live" ? "live" : "idle"}>{label.toLowerCase()}</StatusPill>;
}
