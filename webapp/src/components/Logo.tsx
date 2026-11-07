interface LogoMarkProps {
  size?: number;
  animated?: boolean;
}

/** Smoke-curl + device mark, matching the design doc's icon lock-up. */
export function LogoMark({ size = 52, animated = false }: LogoMarkProps) {
  return (
    <svg width={size} height={(size * 80) / 48} viewBox="0 0 48 80" fill="none">
      <g style={animated ? { animation: "sf-smoke 3s ease-in-out infinite" } : undefined}>
        <path d="M27 5 C41 16 12 25 26 39" stroke="var(--sf-accent)" strokeWidth="6" strokeLinecap="round" fill="none" />
        <path d="M15 15 C24 23 8 29 16 37" stroke="var(--sf-accent)" strokeWidth="3.5" strokeLinecap="round" fill="none" opacity="0.5" />
      </g>
      <rect x="21" y="43" width="10" height="7" rx="2" fill="#e9e9ed" />
      <rect x="17" y="50" width="18" height="27" rx="6" stroke="#e9e9ed" strokeWidth="3.5" fill="none" />
    </svg>
  );
}

export function LogoWordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <svg width="17" height="27" viewBox="0 0 48 80" fill="none">
        <path d="M27 5 C41 16 12 25 26 39" stroke="var(--sf-accent)" strokeWidth="7" strokeLinecap="round" fill="none" />
        <rect x="21" y="43" width="10" height="7" rx="2" fill="#e9e9ed" />
        <rect x="17" y="50" width="18" height="27" rx="6" stroke="#e9e9ed" strokeWidth="4" fill="none" />
      </svg>
      <div style={{ font: "700 14px var(--font-heading)", letterSpacing: ".05em" }}>
        SMOKE
        <span style={{ font: "500 9.5px var(--font-heading)", letterSpacing: ".3em", color: "var(--color-neutral-500)", marginLeft: 6 }}>
          FINDER
        </span>
      </div>
    </div>
  );
}
