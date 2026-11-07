import { useLang } from "../i18n";

interface HeaderProps {
  title: string;
  onBack?: () => void;
  onClose?: () => void;
  onMenu?: () => void;
  /** Pins the header to the top while the page scrolls, with a translucent
   * blurred background — for screens with a hero image right below it. */
  overlay?: boolean;
}

export function Header({ title, onBack, onClose, onMenu, overlay }: HeaderProps) {
  const { t } = useLang();
  return (
    <div className={overlay ? "sf-header sf-header-overlay" : "sf-header"}>
      {onBack && (
        <button className="sf-icon-btn" style={{ color: "var(--sf-accent)" }} onClick={onBack} aria-label="Back">
          ‹
        </button>
      )}
      {onClose && (
        <button className="sf-icon-btn" onClick={onClose} aria-label="Close">
          ✕
        </button>
      )}
      <div className="sf-header-title">
        <div className="name">{title}</div>
        <div className="sub">{t.miniapp}</div>
      </div>
      {onMenu && (
        <button className="sf-icon-btn" onClick={onMenu} aria-label="Account">
          ⋮
        </button>
      )}
    </div>
  );
}
