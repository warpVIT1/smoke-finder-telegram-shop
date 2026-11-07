interface StatusStepperProps {
  labels: [string, string, string];
  activeIndex: 0 | 1 | 2;
}

export function StatusStepper({ labels, activeIndex }: StatusStepperProps) {
  const dot = (filled: boolean, pulse: boolean) => (
    <span
      style={{
        width: 9,
        height: 9,
        borderRadius: "50%",
        background: filled ? "var(--sf-accent)" : "var(--color-neutral-800)",
        flex: "none",
        animation: pulse ? "sf-pulse 2s infinite" : undefined,
      }}
    />
  );
  const line = (filled: boolean) => (
    <span style={{ flex: 1, height: 2, background: filled ? "var(--sf-accent)" : "var(--color-neutral-800)" }} />
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", margin: "14px 0 4px" }}>
        {dot(activeIndex >= 0, false)}
        {line(activeIndex >= 1)}
        {dot(activeIndex >= 1, activeIndex === 1)}
        {line(activeIndex >= 2)}
        {dot(activeIndex >= 2, activeIndex === 2)}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", font: "600 9.5px var(--font-body)" }}>
        {labels.map((label, i) => (
          <span key={label} style={{ color: i <= activeIndex ? (i === activeIndex ? "var(--sf-accent)" : "var(--color-neutral-500)") : "var(--color-neutral-600)" }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
