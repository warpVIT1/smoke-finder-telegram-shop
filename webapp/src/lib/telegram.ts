import { useEffect, useRef } from "react";

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  /** Only present when the user's privacy settings allow Mini Apps to see it. */
  photo_url?: string;
}

interface MainButtonApi {
  text: string;
  isVisible: boolean;
  isActive: boolean;
  setText(text: string): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
  show(): void;
  hide(): void;
  enable(): void;
  disable(): void;
  showProgress(leaveActive?: boolean): void;
  hideProgress(): void;
}

interface BackButtonApi {
  isVisible: boolean;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
  show(): void;
  hide(): void;
}

interface HapticFeedbackApi {
  impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
  notificationOccurred(type: "error" | "success" | "warning"): void;
  selectionChanged(): void;
}

interface WebAppApi {
  initData: string;
  initDataUnsafe: { user?: TelegramUser };
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  MainButton: MainButtonApi;
  BackButton: BackButtonApi;
  HapticFeedback: HapticFeedbackApi;
  ready(): void;
  expand(): void;
  close(): void;
  onEvent(event: string, cb: () => void): void;
  offEvent(event: string, cb: () => void): void;
  showAlert(message: string, callback?: () => void): void;
  showPopup(
    params: { title?: string; message: string; buttons?: { id?: string; type?: "default" | "ok" | "close" | "cancel" | "destructive"; text?: string }[] },
    callback?: (buttonId: string | undefined) => void
  ): void;
  openTelegramLink(url: string): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp: WebAppApi };
  }
}

export function getWebApp(): WebAppApi | null {
  return typeof window !== "undefined" && window.Telegram ? window.Telegram.WebApp : null;
}

export function getInitData(): string {
  return getWebApp()?.initData ?? "";
}

export function getTelegramUser(): TelegramUser | null {
  return getWebApp()?.initDataUnsafe.user ?? null;
}

/**
 * Telegram's own `telegram-web-app.js` defines `window.Telegram.WebApp` even when
 * the page is opened in a plain browser tab (a documented degraded/stub mode for
 * development) — its MainButton/BackButton calls are silent no-ops there, so
 * `!!getWebApp()` alone is NOT a reliable "are we really inside Telegram" check.
 * `initData` is only ever populated by a real Telegram client, so check that instead.
 */
export function isInsideTelegram(): boolean {
  const app = getWebApp();
  return !!app && app.initData.length > 0;
}

/** Native alert inside Telegram, plain `alert()` fallback outside it (dev/testing). */
export function showInfo(message: string) {
  const app = getWebApp();
  if (app && isInsideTelegram()) app.showAlert(message);
  else alert(message);
}

/** Opens a t.me link via Telegram's own navigation inside Telegram, a new tab outside it. */
export function openTelegramLink(url: string) {
  const app = getWebApp();
  if (app && isInsideTelegram()) app.openTelegramLink(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

export function useTelegramReady() {
  useEffect(() => {
    const app = getWebApp();
    if (!app) return;
    app.ready();
    app.expand();
  }, []);
}

interface MainButtonOptions {
  text: string;
  onClick: () => void;
  visible?: boolean;
  active?: boolean;
  loading?: boolean;
}

/** Drives Telegram's native bottom MainButton for the lifetime of the calling screen. */
export function useMainButton({ text, onClick, visible = true, active = true, loading = false }: MainButtonOptions) {
  const handlerRef = useRef(onClick);
  handlerRef.current = onClick;

  useEffect(() => {
    const app = getWebApp();
    if (!app) return;
    const button = app.MainButton;
    const handler = () => handlerRef.current();

    button.setText(text);
    if (visible) button.show();
    else button.hide();
    if (active) button.enable();
    else button.disable();
    if (loading) button.showProgress(true);
    else button.hideProgress();

    button.onClick(handler);
    return () => {
      button.offClick(handler);
      button.hide();
    };
  }, [text, visible, active, loading]);
}

/** Drives Telegram's native BackButton; calls onBack and hides itself on unmount. */
export function useBackButton(onBack: (() => void) | null) {
  const handlerRef = useRef(onBack);
  handlerRef.current = onBack;

  useEffect(() => {
    const app = getWebApp();
    if (!app) return;
    const button = app.BackButton;
    const handler = () => handlerRef.current?.();

    if (onBack) {
      button.show();
      button.onClick(handler);
    } else {
      button.hide();
    }
    return () => {
      button.offClick(handler);
      button.hide();
    };
  }, [!!onBack]);
}

export function haptic(style: "light" | "medium" | "heavy" = "light") {
  getWebApp()?.HapticFeedback.impactOccurred(style);
}
