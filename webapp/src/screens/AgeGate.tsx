import { useLang } from "../i18n";
import { LogoMark } from "../components/Logo";
import { ActionButton } from "../components/ActionButton";
import { getWebApp } from "../lib/telegram";
import { useSessionStore } from "../store/session";

export function AgeGate() {
  const { t } = useLang();
  const confirmAge = useSessionStore((s) => s.confirmAge);

  return (
    <div className="sf-screen" style={{ alignItems: "center", textAlign: "center", paddingTop: 56, gap: 18 }}>
      <LogoMark size={52} animated />
      <div style={{ font: "700 30px var(--font-heading)", letterSpacing: ".02em" }}>{t.ageTitle}</div>
      <div style={{ font: "400 13px/1.6 var(--font-body)", color: "var(--color-neutral-400)", maxWidth: 270 }}>{t.ageSub}</div>
      <div style={{ width: "100%", background: "var(--color-surface)", borderRadius: "var(--radius-md)", padding: "12px 14px", font: "400 11px/1.55 var(--font-body)", color: "var(--color-neutral-500)", textAlign: "left" }}>
        {t.ageNote}
      </div>
      <button
        onClick={() => getWebApp()?.close()}
        style={{
          width: "100%",
          padding: 11,
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-neutral-700)",
          background: "transparent",
          font: "500 13px var(--font-body)",
          color: "var(--color-neutral-400)",
          cursor: "pointer",
        }}
      >
        {t.ageOut}
      </button>
      <ActionButton text={t.ageIn} onClick={confirmAge} />
    </div>
  );
}
