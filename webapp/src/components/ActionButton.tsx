import { useMainButton, isInsideTelegram } from "../lib/telegram";

interface ActionButtonProps {
  text: string;
  onClick: () => void;
  visible?: boolean;
  active?: boolean;
  loading?: boolean;
}

/**
 * Drives Telegram's native MainButton when running inside Telegram. Outside it
 * (a plain browser tab, used for dev/testing — `window.Telegram.WebApp` exists
 * there too, as an inert stub, so checking for its mere presence isn't enough)
 * there is no MainButton at all, so this renders a real fallback button with the
 * same look — otherwise every primary action on every screen is invisible and
 * unclickable outside Telegram.
 */
export function ActionButton({ text, onClick, visible = true, active = true, loading = false }: ActionButtonProps) {
  useMainButton({ text, onClick, visible, active, loading });

  if (isInsideTelegram() || !visible) return null;

  return (
    <div className="sf-bottom-fallback">
      <button className="sf-main-button" disabled={!active || loading} onClick={onClick}>
        {text}
      </button>
    </div>
  );
}
