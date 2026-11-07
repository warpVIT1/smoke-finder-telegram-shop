import { createContext, useContext } from "react";
import { DICT, type Dict, type Lang } from "./dict";

export { DICT };
export type { Dict, Lang };

export interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Dict;
}

export const LangContext = createContext<LangContextValue | null>(null);

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}

/** Default language is always English unless the user explicitly picked another one before. */
export function detectInitialLang(): Lang {
  const stored = localStorage.getItem("sf-lang");
  if (stored === "en" || stored === "uk" || stored === "ru") return stored;
  return "en";
}
