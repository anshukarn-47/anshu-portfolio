"use client";

import { useEffect, useState, type ComponentType } from "react";
import type { PrototypeCaseStudy } from "@/components/prototypes/engine/case-study-view";

/** What every canvas receives from the viewer. */
export type CanvasProps = {
  /** The related work record from Supabase (null if unpublished). */
  caseStudy: PrototypeCaseStudy | null;
  /** Call when the player reaches the end, to unlock anything held back until then. */
  onComplete: () => void;
};

type Loader = () => Promise<ComponentType<CanvasProps>>;

/**
 * A canvas that loads its prototype's code on demand (the same pattern as the
 * arcade games), so a prototype's page only downloads that prototype. Once
 * loaded, the component is cached, so Restart (a remount) is instant.
 */
function lazyCanvas(load: Loader): ComponentType<CanvasProps> {
  let cached: ComponentType<CanvasProps> | null = null;
  function LazyCanvas(props: CanvasProps) {
    const [Canvas, setCanvas] = useState<ComponentType<CanvasProps> | null>(() => cached);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
      if (Canvas) return;
      let live = true;
      load()
        .then((c) => {
          cached = c;
          if (live) setCanvas(() => c);
        })
        .catch(() => live && setFailed(true));
      return () => {
        live = false;
      };
    }, [Canvas]);
    if (failed) return <p className="p-8 text-sm text-text-dim">The prototype didn&apos;t load. Refresh the page to try again.</p>;
    if (!Canvas)
      return (
        <div role="status" className="p-8 text-sm text-text-dim">
          Loading the prototype…
        </div>
      );
    return <Canvas {...props} />;
  }
  return LazyCanvas;
}

/** Interactive canvas for each registry slug (lib/prototypes/registry.ts), each loaded on demand. */
export const PROTOTYPE_CANVASES: Record<string, ComponentType<CanvasProps>> = {
  "crisis-simulator": lazyCanvas(() => import("./crisis-simulator/crisis-simulator").then((m) => m.CrisisSimulator)),
  "control-tower-24": lazyCanvas(() => import("./control-tower/control-tower").then((m) => m.ControlTower)),
  "resolve-x": lazyCanvas(() => import("./resolve-x/resolve-x").then((m) => m.ResolveX)),
};
