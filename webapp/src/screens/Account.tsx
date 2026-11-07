import { useEffect, useState } from "react";
import { useLang, type Lang } from "../i18n";
import { Header } from "../components/Header";
import { StatusStepper } from "../components/StatusStepper";
import { ActionButton } from "../components/ActionButton";
import { formatCents } from "../lib/format";
import { useBackButton, getTelegramUser } from "../lib/telegram";
import { fetchOrders, fetchMe, sendContactHint, fetchBotInfo, type ApiOrder, type ApiMe } from "../lib/api";
import { useCartStore } from "../store/cart";

interface AccountProps {
  onBack: () => void;
  onOpenCart: () => void;
  onOpenAddresses: () => void;
  onOpenAbout: () => void;
  onOpenWishlist: () => void;
}

// The stepper only has 3 slots — accepted/packed both read as "being
// prepared" (slot 1), ready_pickup gets its own final slot (2).
const STATUS_INDEX: Record<string, 0 | 1 | 2> = { placed: 0, accepted: 1, packed: 1, ready_pickup: 2 };
const ACTIVE_STATUSES = ["placed", "accepted", "packed", "ready_pickup"];

export function Account({ onBack, onOpenCart, onOpenAddresses, onOpenAbout, onOpenWishlist }: AccountProps) {
  const { t, lang, setLang } = useLang();
  const tgUser = getTelegramUser();
  const addItem = useCartStore((s) => s.addItem);

  const [me, setMe] = useState<ApiMe | null>(null);
  const [orders, setOrders] = useState<ApiOrder[] | null>(null);
  const [botUsername, setBotUsername] = useState<string | null>(null);

  useBackButton(onBack);

  useEffect(() => {
    fetchMe().then(setMe).catch(() => setMe(null));
    fetchOrders().then(setOrders).catch(() => setOrders([]));
    fetchBotInfo()
      .then((info) => setBotUsername(info.username))
      .catch(() => setBotUsername(null));
  }, []);

  const referralLink = botUsername && tgUser ? `https://t.me/${botUsername}?start=${tgUser.id}` : null;
  const handleCopyReferralLink = () => {
    if (!referralLink) return;
    navigator.clipboard?.writeText(referralLink).catch(() => {});
  };

  const currentOrder = orders?.find((o) => ACTIVE_STATUSES.includes(o.status));
  const pastOrders = orders?.filter((o) => o.status === "delivered" || o.status === "cancelled") ?? [];
  const lastOrder = orders?.[0];

  const handleReorder = () => {
    if (!lastOrder) return;
    lastOrder.items.forEach((item) => {
      addItem({ productId: item.productId, name: item.productId, flavour: item.flavour ?? undefined, unitPriceCents: item.unitPriceCents }, item.qty);
    });
    onOpenCart();
  };

  // .charAt(0) breaks on names that start with an emoji (e.g. "💜warpVIT💜")
  // — it grabs half of the surrogate pair and renders as a broken glyph.
  // Find the first real letter/digit instead, skipping decorative symbols.
  const displayName = me?.firstName ?? tgUser?.first_name ?? "";
  const initial = (displayName.match(/\p{L}|\p{N}/u)?.[0] ?? "?").toUpperCase();

  // Sends the "write your question" prompt into the customer's own chat with
  // the bot — no separate DM with the admin involved, no popup, no
  // WebApp.close() (that fully terminates the mini app and feels like a
  // crash, and there's no "minimize" API for bot mini apps) — just fires the
  // message and leaves the mini app exactly as it is.
  const handleContact = (orderId?: number) => {
    sendContactHint(orderId ? { orderId } : undefined).catch((err) => console.error("Failed to send contact hint:", err));
  };

  return (
    <>
      <Header title={t.profile} onBack={onBack} />
      <div className="sf-screen">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {tgUser?.photo_url ? (
            <img
              src={tgUser.photo_url}
              alt=""
              style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", flex: "none" }}
            />
          ) : (
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(145deg,#2b2d3c,#1d1f2c)", display: "flex", alignItems: "center", justifyContent: "center", font: "600 20px var(--font-heading)", color: "var(--sf-accent)" }}>
              {initial}
            </div>
          )}
          <div>
            <div style={{ font: "600 16px var(--font-heading)" }}>{me?.firstName ?? tgUser?.first_name ?? "—"}</div>
            <div style={{ font: "400 11.5px var(--font-body)", color: "var(--color-neutral-500)", marginTop: 2 }}>
              {(me?.username ?? tgUser?.username) ? `@${me?.username ?? tgUser?.username}` : ""}
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
            {(["en", "uk", "ru"] as Lang[]).map((l) => (
              <span
                key={l}
                onClick={() => setLang(l)}
                style={{
                  cursor: "pointer",
                  padding: "4px 7px",
                  borderRadius: "var(--radius-sm)",
                  font: "600 10px var(--font-body)",
                  background: lang === l ? "var(--sf-accent)" : "transparent",
                  color: lang === l ? "#1B0703" : "var(--color-neutral-500)",
                }}
              >
                {l.toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        <div style={{ background: "var(--color-surface)", border: "1px solid rgba(255,77,46,.4)", borderRadius: "var(--radius-md)", padding: "13px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ font: "600 15px var(--font-body)", color: "var(--sf-accent)" }}>
              {me?.points ?? 0} {t.points}
            </div>
            <div style={{ font: "400 10.5px var(--font-body)", color: "var(--color-neutral-500)", marginTop: 2 }}>{t.pointsSub}</div>
          </div>
        </div>

        {referralLink && (
          <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-md)", padding: "13px 14px" }}>
            <div style={{ font: "600 13px var(--font-body)" }}>{t.referralTitle}</div>
            <div style={{ font: "400 10.5px var(--font-body)", color: "var(--color-neutral-500)", marginTop: 3 }}>{t.referralSub}</div>
            <div
              onClick={handleCopyReferralLink}
              style={{
                marginTop: 9,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--color-neutral-900)",
                borderRadius: "var(--radius-sm)",
                padding: "8px 10px",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  font: "400 11px var(--font-body)",
                  color: "var(--color-neutral-400)",
                }}
              >
                {referralLink}
              </span>
              <span style={{ font: "600 11px var(--font-body)", color: "var(--sf-accent)", flex: "none" }}>{t.referralCopy}</span>
            </div>
          </div>
        )}

        {currentOrder && (
          <div>
            <div className="sf-section-label">{t.currentOrder}</div>
            <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-md)", padding: "13px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ font: "600 13px var(--font-body)" }}>
                  {t.orderWord} #{currentOrder.id}
                </span>
                <span style={{ font: "600 13px var(--font-body)" }}>{formatCents(currentOrder.totalCents)}</span>
              </div>
              <div style={{ font: "400 11px var(--font-body)", color: "var(--color-neutral-500)", marginTop: 3 }}>
                {currentOrder.items.map((i) => i.productId).join(", ")}
              </div>
              <StatusStepper labels={[t.stPlaced, t.stPacked, t.stWay]} activeIndex={STATUS_INDEX[currentOrder.status] ?? 0} />
              <div
                onClick={() => handleContact(currentOrder.id)}
                style={{
                  marginTop: 11,
                  textAlign: "center",
                  padding: 9,
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-neutral-700)",
                  font: "500 12px var(--font-body)",
                  cursor: "pointer",
                }}
              >
                {currentOrder.deliveryMethod === "pickup" ? t.etaPickup : t.eta}
              </div>
            </div>
          </div>
        )}

        <div>
          <div className="sf-section-label">{t.history}</div>
          <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-md)", padding: "2px 14px" }}>
            {pastOrders.length === 0 && <div style={{ padding: "12px 0", color: "var(--color-neutral-600)", fontSize: 12 }}>{t.noResults}</div>}
            {pastOrders.map((o) => (
              <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderBottom: "1px solid var(--color-divider)" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ font: "600 12.5px var(--font-body)" }}>
                    {t.orderWord} #{o.id} · {formatCents(o.totalCents)}
                  </div>
                  <div style={{ font: "400 10.5px var(--font-body)", color: "var(--color-neutral-500)", marginTop: 2 }}>
                    {new Date(o.createdAt).toLocaleDateString()} · {o.items.map((i) => i.productId).join(", ")}
                  </div>
                </div>
                <span
                  style={{
                    font: "600 10px var(--font-body)",
                    padding: "3px 8px",
                    borderRadius: "var(--radius-sm)",
                    border: `1px solid ${o.status === "delivered" ? "var(--color-ok)" : "var(--color-error)"}`,
                    color: o.status === "delivered" ? "var(--color-ok)" : "var(--color-error)",
                  }}
                >
                  {o.status === "delivered" ? t.hDelivered : t.hCancelled}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-md)", padding: "2px 14px" }}>
          <StaticRow label={t.myWishlist} onClick={onOpenWishlist} />
          <StaticRow label={t.addresses} onClick={onOpenAddresses} />
          <StaticRow label={t.support} onClick={() => handleContact()} />
          <StaticRow label={t.about} onClick={onOpenAbout} last />
        </div>
      </div>
      <ActionButton
        text={lastOrder ? `${t.repeatBtn} — ${formatCents(lastOrder.totalCents)}` : t.repeatBtn}
        onClick={handleReorder}
        visible={!!lastOrder}
      />
    </>
  );
}

function StaticRow({ label, onClick, last }: { label: string; onClick: () => void; last?: boolean }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "12px 0",
        borderBottom: last ? "none" : "1px solid var(--color-divider)",
        font: "500 12.5px var(--font-body)",
        cursor: "pointer",
      }}
    >
      {label}
      <span style={{ marginLeft: "auto", color: "var(--color-neutral-600)" }}>›</span>
    </div>
  );
}
