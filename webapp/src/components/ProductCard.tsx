import { imageSrc, type ApiProduct } from "../lib/api";
import { formatCents } from "../lib/format";
import { useLang } from "../i18n";

interface ProductCardProps {
  product: ApiProduct;
  onOpen: () => void;
}

export function ProductCard({ product, onOpen }: ProductCardProps) {
  const { t } = useLang();
  const stockLabel =
    product.stockState === "low" ? t.low(product.stockCount ?? 0) : product.stockState === "preorder" ? t.preorder : t.inStock;
  const stockColor =
    product.stockState === "low" ? "var(--sf-accent)" : product.stockState === "preorder" ? "var(--color-neutral-500)" : "var(--color-ok)";

  return (
    <div style={{ display: "flex", gap: 11, background: "var(--color-surface)", borderRadius: "var(--radius-md)", padding: 10 }}>
      <div
        onClick={onOpen}
        style={{
          width: 76,
          height: 76,
          borderRadius: "var(--radius-sm)",
          background: imageSrc(product.imageUrl) ? `center/cover no-repeat url(${imageSrc(product.imageUrl)})` : "linear-gradient(145deg,#2b2d3c,#1d1f2c)",
          flex: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          cursor: "pointer",
        }}
      >
        {!imageSrc(product.imageUrl) && (
          <span style={{ font: "500 8.5px ui-monospace,monospace", color: "var(--color-neutral-600)" }}>photo</span>
        )}
        {product.isNew && (
          <span
            style={{
              position: "absolute",
              top: 5,
              left: 5,
              font: "700 8.5px var(--font-body)",
              padding: "2px 5px",
              borderRadius: 3,
              background: "var(--sf-accent)",
              color: "#1B0703",
            }}
          >
            {t.newBadge}
          </span>
        )}
        {!product.isNew && product.badge && (
          <span
            style={{
              position: "absolute",
              top: 5,
              left: 5,
              font: "600 8.5px var(--font-body)",
              padding: "2px 5px",
              borderRadius: 3,
              background: product.badgeBg ?? "var(--sf-accent)",
              color: "#1B0703",
            }}
          >
            {product.badge}
          </span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }} onClick={onOpen}>
        <div style={{ font: "600 13px var(--font-body)", lineHeight: 1.3, cursor: "pointer" }}>{product.name}</div>
        <div style={{ font: "400 10.5px/1.4 var(--font-body)", color: "var(--color-neutral-500)" }}>
          {product.flavour ?? ""}
        </div>
        <div style={{ font: "500 10px var(--font-body)", color: stockColor }}>{stockLabel}</div>
        <div style={{ marginTop: "auto" }}>
          <span style={{ font: "600 14px var(--font-body)" }}>{formatCents(product.priceCents)}</span>
          {product.oldPriceCents && (
            <span
              style={{
                font: "400 10.5px var(--font-body)",
                color: "var(--color-neutral-600)",
                textDecoration: "line-through",
                marginLeft: 5,
              }}
            >
              {formatCents(product.oldPriceCents)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
