interface QtyStepperProps {
  qty: number;
  onChange: (qty: number) => void;
  min?: number;
}

export function QtyStepper({ qty, onChange, min = 1 }: QtyStepperProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: "var(--color-neutral-900)",
        borderRadius: "var(--radius-md)",
        padding: "8px 14px",
        font: "600 14px var(--font-body)",
      }}
    >
      <span
        onClick={() => onChange(Math.max(min - 1, qty - 1))}
        style={{ color: "var(--color-neutral-500)", cursor: "pointer", width: 16, textAlign: "center" }}
      >
        −
      </span>
      <span>{qty}</span>
      <span onClick={() => onChange(qty + 1)} style={{ color: "var(--sf-accent)", cursor: "pointer", width: 16, textAlign: "center" }}>
        +
      </span>
    </div>
  );
}
