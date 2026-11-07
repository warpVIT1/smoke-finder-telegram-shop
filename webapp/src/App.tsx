import { useMemo, useState } from "react";
import { LangContext, detectInitialLang, DICT, type Lang } from "./i18n";
import { useTelegramReady, getTelegramUser, isInsideTelegram } from "./lib/telegram";
import { setMyLanguage } from "./lib/api";
import { useSessionStore } from "./store/session";
import { AgeGate } from "./screens/AgeGate";
import { Catalog } from "./screens/Catalog";
import { Product } from "./screens/Product";
import { Cart } from "./screens/Cart";
import { Account } from "./screens/Account";
import { Addresses } from "./screens/Addresses";
import { About } from "./screens/About";
import { AdminOrders } from "./screens/AdminOrders";
import { MyWishlist } from "./screens/MyWishlist";

const ADMIN_TELEGRAM_ID = Number(import.meta.env.VITE_ADMIN_TELEGRAM_ID);

type Screen =
  | { name: "catalog" }
  | { name: "product"; productId: string }
  | { name: "cart" }
  | { name: "account" }
  | { name: "addresses" }
  | { name: "about" }
  | { name: "wishlist" };

export default function App() {
  useTelegramReady();

  // Reachable only via the bot's hidden admin command's own button (`?admin=1`),
  // and only ever renders for the configured admin's own Telegram id — anyone
  // else opening that URL falls straight through to the normal shop below.
  const isAdminRequest = new URLSearchParams(window.location.search).get("admin") === "1";
  const isAdmin = isAdminRequest && !!ADMIN_TELEGRAM_ID && getTelegramUser()?.id === ADMIN_TELEGRAM_ID;

  const [lang, setLangState] = useState<Lang>(() => detectInitialLang());
  const setLang = (next: Lang) => {
    localStorage.setItem("sf-lang", next);
    setLangState(next);
    // Persists so the bot's own chat messages (order confirmations, etc.)
    // match this choice too — only meaningful with real Telegram initData.
    if (isInsideTelegram()) {
      setMyLanguage(next).catch((err) => console.error("Failed to save language:", err));
    }
  };
  const langValue = useMemo(() => ({ lang, setLang, t: DICT[lang] }), [lang]);

  const ageConfirmed = useSessionStore((s) => s.ageConfirmed);

  const [stack, setStack] = useState<Screen[]>([{ name: "catalog" }]);
  const current = stack[stack.length - 1];

  function push(screen: Screen) {
    setStack((s) => [...s, screen]);
  }
  function pop() {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }
  function resetToCatalog() {
    setStack([{ name: "catalog" }]);
  }

  if (isAdmin) {
    return (
      <div className="sf-app">
        <AdminOrders />
      </div>
    );
  }

  if (!ageConfirmed) {
    return (
      <LangContext.Provider value={langValue}>
        <div className="sf-app">
          <AgeGate />
        </div>
      </LangContext.Provider>
    );
  }

  return (
    <LangContext.Provider value={langValue}>
      <div className="sf-app">
        {current.name === "catalog" && (
          <Catalog
            onOpenProduct={(id) => push({ name: "product", productId: id })}
            onOpenCart={() => push({ name: "cart" })}
            onOpenAccount={() => push({ name: "account" })}
          />
        )}
        {current.name === "product" && (
          <Product productId={current.productId} onBack={pop} onOpenCart={() => push({ name: "cart" })} />
        )}
        {current.name === "cart" && <Cart onBack={pop} onOrderPlaced={resetToCatalog} />}
        {current.name === "account" && (
          <Account
            onBack={pop}
            onOpenCart={() => push({ name: "cart" })}
            onOpenAddresses={() => push({ name: "addresses" })}
            onOpenAbout={() => push({ name: "about" })}
            onOpenWishlist={() => push({ name: "wishlist" })}
          />
        )}
        {current.name === "addresses" && <Addresses onBack={pop} />}
        {current.name === "about" && <About onBack={pop} />}
        {current.name === "wishlist" && (
          <MyWishlist onBack={pop} onOpenProduct={(id) => push({ name: "product", productId: id })} />
        )}
      </div>
    </LangContext.Provider>
  );
}
