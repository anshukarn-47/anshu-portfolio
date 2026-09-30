/** Controls under the canvas: restart the prototype, and open the Product lens. */
export function PrototypeControls({
  onReset,
  lensOpen,
  onToggleLens,
  lensId,
  lensButtonRef,
}: {
  onReset: () => void;
  lensOpen: boolean;
  onToggleLens: () => void;
  lensId: string;
  /** Focus returns here when the lens is closed from inside it. */
  lensButtonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        onClick={onReset}
        className="rounded-md border border-rule px-3 py-1.5 text-sm text-text-dim transition-colors hover:bg-panel-2 hover:text-text"
      >
        Restart
      </button>
      <button
        ref={lensButtonRef}
        type="button"
        onClick={onToggleLens}
        aria-expanded={lensOpen}
        aria-controls={lensId}
        className={`rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-panel-2 ${
          lensOpen ? "border-signal-blue text-text" : "border-rule text-text-dim hover:text-text"
        }`}
      >
        {lensOpen ? "Hide product lens" : "Product lens"}
      </button>
    </div>
  );
}
