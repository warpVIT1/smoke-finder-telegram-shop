import { useLang } from "../i18n";
import { Header } from "../components/Header";
import { LogoMark } from "../components/Logo";
import { useBackButton } from "../lib/telegram";

interface AboutProps {
  onBack: () => void;
}

export function About({ onBack }: AboutProps) {
  const { t } = useLang();
  useBackButton(onBack);

  return (
    <>
      <Header title={t.about} onBack={onBack} />
      <div className="sf-screen">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "12px 0" }}>
          <LogoMark size={44} />
          <div style={{ font: "700 18px var(--font-heading)" }}>Smoke Finder</div>
          <div style={{ font: "400 12px/1.6 var(--font-body)", color: "var(--color-neutral-400)", textAlign: "center", maxWidth: 300 }}>
            {t.aboutBody}
          </div>
        </div>

        <div className="sf-card">
          <Row label={t.courierT} value={t.courierS} />
          <Row label={t.pickupT} value={t.pickupS} />
          <Row label={t.paymentLbl} value={`${t.etT} · ${t.cashT}`} last />
        </div>

        <div className="sf-card">
          <Row label={t.support} value="@Smoke_Finder_bot" />
        </div>
      </div>
    </>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 0",
        borderBottom: last ? "none" : "1px solid var(--color-divider)",
        font: "400 12px var(--font-body)",
      }}
    >
      <span style={{ color: "var(--color-neutral-500)" }}>{label}</span>
      <span style={{ color: "var(--color-text)", fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
  );
}
