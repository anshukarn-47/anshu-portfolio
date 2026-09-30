export function PageIntro({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <>
      <h1 className="text-4xl sm:text-5xl">{title}</h1>
      {children && <p className="mt-4 max-w-prose text-lg text-text-dim">{children}</p>}
    </>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="mt-12 rounded-lg border border-dashed border-rule bg-panel p-8 text-text-dim">{children}</div>;
}
