"use client";

import type { ComponentType } from "react";
import type { PrototypeCaseStudy } from "@/components/prototypes/engine/case-study-view";
import { CrisisSimulator } from "./crisis-simulator/crisis-simulator";
import { ControlTower } from "./control-tower/control-tower";
import { ResolveX } from "./resolve-x/resolve-x";

/** What every canvas receives from the viewer. */
export type CanvasProps = {
  /** The related work record from Supabase (null if unpublished). */
  caseStudy: PrototypeCaseStudy | null;
  /** Call when the player reaches the end, to unlock anything held back until then. */
  onComplete: () => void;
};

/** Interactive canvas for each registry slug (lib/prototypes/registry.ts). */
export const PROTOTYPE_CANVASES: Record<string, ComponentType<CanvasProps>> = {
  "crisis-simulator": CrisisSimulator,
  "control-tower-24": ControlTower,
  "resolve-x": ResolveX,
};
