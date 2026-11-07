import { useEffect, useState } from "react";
import { useLang } from "../i18n";
import { Header } from "../components/Header";
import { QtyStepper } from "../components/QtyStepper";
import { ActionButton } from "../components/ActionButton";
import { fetchProduct, imageSrc, addToWishlist, type ApiProductDetail } from "../lib/api";
import { formatCents } from "../lib/format";
import { useBackButton } from "../lib/telegram";
import { useCartStore } from "../store/cart";

interface ProductProps {
  productId: string;
  onBack: () => void;
  onOpenCart: () => void;
}

export function Product({ productId, onBack }: ProductProps) {
  const { t, lang } = useLang();
  const [product, setProduct] = useState<ApiProductDetail | null>(null);
  const [flavour, setFlavour] = useState<string | undefined>(undefined);
  const [qty, setQty] = useState(1);
  const addItem = useCartStore((s) => s.addItem);

  useBackButton(onBack);

  useEffect(() => {
    setProduct(null);
    fetchProduct(productId).then((p) => {
      setProduct(p);
      // Falls back to the first variant even if it's sold out — on a preorder
      // product every variant is sold out, and leaving nothing preselected
      // there just looked broken with no obvious way to pick one.
      const firstAvailable = p.flavours.find((f) => !f.soldOut) ?? p.flavours[0];
      setFlavour(firstAvailable?.name);
    });
  }, [productId]);

  const variantRequired = !!product && product.flavours.length > 0;
  const variantChosen = !variantRequired || !!flavour;

  const handleAddToCart = () => {
    if (!product || !variantChosen) return;
    addItem({ productId: product.id, name: product.name, flavour, unitPriceCents: product.priceCents, pointsPrice: product.pointsPrice }, qty);
    onBack();
  };

  // Out-of-stock items aren't purchasable yet — this just records interest
  // (so the shop knows what to actually buy). The "willing to prepay for a
  // lifetime 5% discount" pitch lives in the customer's own Wishlist screen
  // now, not as a popup here.
  const handleAddToWishlist = async () => {
    if (!product || !variantChosen) return;
    try {
      await addToWishlist(product.id, flavour);
    } catch (err) {
      console.error("Failed to add to wishlist:", err);
      return;
    }
    onBack();
  };

  if (!product) {
    return (
      <>
        <Header title={t.loading} onBack={onBack} />
        <div className="sf-screen" />
      </>
    );
  }

  const stockLabel =
    product.stockState === "low" ? t.low(product.stockCount ?? 0) : product.stockState === "preorder" ? t.preorder : t.inStock;
  const photo = imageSrc(product.imageUrl);
  const selectedFlavour = product.flavours.find((f) => f.name === flavour);
  const flavourDescription = selectedFlavour
    ? lang === "uk"
      ? selectedFlavour.descriptionUk
      : lang === "ru"
        ? selectedFlavour.descriptionRu
        : selectedFlavour.descriptionEn
    : null;

  return (
    <>
      <Header title="Smoke Finder" onBack={onBack} overlay />
      <div
        style={{
          minHeight: photo ? undefined : 228,
          background: "linear-gradient(150deg,#2b2d3c,#1a1c28)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {photo ? (
          // Real <img> at full width with auto height — shows the whole photo
          // at its natural aspect ratio (no cropping, no shrunken letterboxing
          // inside a fixed-height box).
          <img src={photo} alt={product.name} style={{ width: "100%", height: "auto", display: "block" }} />
        ) : (
          <span style={{ font: "500 10px ui-monospace,monospace", color: "var(--color-neutral-600)" }}>{product.name} · photo</span>
        )}
        {product.bestSeller && (
          <span
            style={{
              position: "absolute",
              top: 10,
              left: 12,
              font: "600 10px var(--font-body)",
              padding: "3px 8px",
              borderRadius: "var(--radius-sm)",
              background: "var(--sf-accent)",
              color: "#1B0703",
            }}
          >
            {t.best}
          </span>
        )}
      </div>

      <div className="sf-screen">
        <div>
          <div style={{ font: "600 18px var(--font-heading)" }}>{product.name}</div>
          <div style={{ font: "400 11.5px var(--font-body)", color: "var(--color-neutral-500)", marginTop: 3 }}>
            {[product.flavour, product.puffs ? t.pDesc1 : null].filter(Boolean).join(" · ")}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ font: "600 23px var(--font-body)" }}>{formatCents(product.priceCents)}</span>
          {product.oldPriceCents && (
            <span style={{ font: "400 13px var(--font-body)", color: "var(--color-neutral-600)", textDecoration: "line-through" }}>
              {formatCents(product.oldPriceCents)}
            </span>
          )}
          {product.stockState === "low" && (
            <span style={{ marginLeft: "auto", font: "600 11.5px var(--font-body)", color: "var(--sf-accent)" }}>{stockLabel}</span>
          )}
        </div>

        {product.flavours.length > 0 && (
          <div>
            <div className="sf-section-label">
              {product.variantLabel === "colour" ? t.colourLbl : product.variantLabel === "ohm" ? t.ohmLbl : t.flavourLbl}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {product.flavours.map((f) => {
                const selected = f.name === flavour;
                // A sold-out variant can't be added to cart, but on a preorder
                // product EVERY variant is sold out — the customer still needs
                // to be able to pick one to say which they want wishlisted, and
                // striking through every single option there just reads as
                // "nothing here works" instead of "pick which one you want".
                const isPreorder = product.stockState === "preorder";
                const canPick = isPreorder || !f.soldOut;
                const showAsSoldOut = f.soldOut && !isPreorder;
                return (
                  <span
                    key={f.name}
                    onClick={() => canPick && setFlavour(f.name)}
                    style={{
                      padding: "8px 13px",
                      borderRadius: "var(--radius-md)",
                      border: selected ? "1px solid var(--sf-accent)" : "1px solid transparent",
                      color: selected ? "var(--sf-accent)" : showAsSoldOut ? "var(--color-neutral-600)" : "var(--color-text)",
                      background: selected ? "rgba(255,77,46,.12)" : "var(--color-neutral-900)",
                      font: "600 12px var(--font-body)",
                      textDecoration: showAsSoldOut ? "line-through" : undefined,
                      cursor: canPick ? "pointer" : "not-allowed",
                    }}
                  >
                    {f.name}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <QtyStepper qty={qty} onChange={(q) => setQty(Math.max(1, q))} />
          {product.charging && (
            <span style={{ font: "400 11px/1.45 var(--font-body)", color: "var(--color-neutral-500)" }}>{product.charging}</span>
          )}
        </div>

        {flavourDescription && (
          <div style={{ font: "400 12px/1.6 var(--font-body)", color: "var(--color-neutral-300)" }}>{flavourDescription}</div>
        )}

        <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-md)", padding: "2px 14px" }}>
          {product.puffs && (
            <SpecRow label={t.puffs} value={`~${product.puffs.toLocaleString()}`} />
          )}
          <SpecRow label={t.nicotine} value={`${product.nicotineMg} mg`} />
          {product.charging && <SpecRow label={t.charging} value={product.charging} last />}
        </div>
      </div>
      {product.stockState === "preorder" ? (
        <ActionButton text={t.wishlistBtn} onClick={handleAddToWishlist} active={variantChosen} />
      ) : (
        <ActionButton text={t.addToCartLabel(formatCents(product.priceCents))} onClick={handleAddToCart} active={variantChosen} />
      )}
    </>
  );
}

function SpecRow({ label, value, valueColor, last }: { label: string; value: string; valueColor?: string; last?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "9px 0",
        borderBottom: last ? "none" : "1px solid var(--color-divider)",
        font: "400 11.5px var(--font-body)",
      }}
    >
      <span style={{ color: "var(--color-neutral-500)" }}>{label}</span>
      <span style={{ fontWeight: 600, color: valueColor }}>{value}</span>
    </div>
  );
}
