import { useEffect, useState } from "react";
import { useLang } from "../i18n";
import { Header } from "../components/Header";
import { useBackButton } from "../lib/telegram";
import { fetchMyWishlist, removeFromWishlist, sendContactHint, imageSrc, type ApiMyWishlistEntry } from "../lib/api";
import { formatCents } from "../lib/format";

interface MyWishlistProps {
  onBack: () => void;
  onOpenProduct: (id: string) => void;
}

export function MyWishlist({ onBack, onOpenProduct }: MyWishlistProps) {
  const { t } = useLang();
  const [items, setItems] = useState<ApiMyWishlistEntry[] | null>(null);

  useBackButton(onBack);

  useEffect(() => {
    fetchMyWishlist().then(setItems).catch(() => setItems([]));
  }, []);

  const handleRemove = async (id: number) => {
    setItems((prev) => prev?.filter((i) => i.id !== id) ?? null);
    try {
      await removeFromWishlist(id);
    } catch {
      fetchMyWishlist().then(setItems).catch(() => {});
    }
  };

  // Drops the "write your message" hint into the customer's own chat with the
  // bot, tagged with which product/flavour this is about — their next plain
  // message is what actually gets sent to the manager, nothing is automatic.
  const handleRequestPrepay = (item: ApiMyWishlistEntry) => {
    sendContactHint({ prepay: { productId: item.productId, flavour: item.flavour ?? undefined } }).catch((err) =>
      console.error("Failed to send prepay contact hint:", err)
    );
  };

  return (
    <>
      <Header title={t.myWishlist} onBack={onBack} />
      <div className="sf-screen">
        {items && items.length > 0 && (
          <div style={{ font: "400 11.5px/1.5 var(--font-body)", color: "var(--color-neutral-500)" }}>{t.wishlistMsg}</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items === null && <div style={{ color: "var(--color-neutral-500)", textAlign: "center", padding: 24 }}>{t.loading}</div>}
          {items?.length === 0 && <div style={{ color: "var(--color-neutral-500)", textAlign: "center", padding: 24 }}>{t.myWishlistEmpty}</div>}
          {items?.map((i) => {
            const photo = imageSrc(i.imageUrl);
            return (
              <div
                key={i.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  background: "var(--color-surface)",
                  borderRadius: "var(--radius-md)",
                  padding: "10px 12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {photo ? (
                    <img src={photo} alt="" style={{ width: 44, height: 44, borderRadius: "var(--radius-sm)", objectFit: "cover", flex: "none", cursor: "pointer" }} onClick={() => onOpenProduct(i.productId)} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: "var(--radius-sm)", background: "var(--color-neutral-900)", flex: "none" }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => onOpenProduct(i.productId)}>
                    <div style={{ font: "600 13px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {i.name}
                      {i.flavour && <span style={{ color: "var(--sf-accent)" }}> · {i.flavour}</span>}
                    </div>
                    <div style={{ font: "400 11.5px var(--font-body)", color: "var(--color-neutral-500)", marginTop: 2 }}>
                      {formatCents(i.priceCents)}
                    </div>
                  </div>
                  <span
                    onClick={() => handleRemove(i.id)}
                    style={{ font: "600 11px var(--font-body)", color: "var(--color-error)", cursor: "pointer", flex: "none" }}
                  >
                    {t.deleteBtn}
                  </span>
                </div>
                <div
                  onClick={() => handleRequestPrepay(i)}
                  style={{
                    textAlign: "center",
                    padding: 8,
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--sf-accent)",
                    color: "var(--sf-accent)",
                    font: "600 11.5px var(--font-body)",
                    cursor: "pointer",
                  }}
                >
                  {t.wishlistManagerBtn}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
