import { useEffect, useState } from "react";
import { useLang } from "../i18n";
import { Header } from "../components/Header";
import { ProductCard } from "../components/ProductCard";
import { ActionButton } from "../components/ActionButton";
import { LogoWordmark } from "../components/Logo";
import { fetchProducts, type ApiProduct } from "../lib/api";
import { formatCents } from "../lib/format";
import { getWebApp } from "../lib/telegram";
import { useCartStore, cartItemCount, cartSubtotalCents } from "../store/cart";

interface CatalogProps {
  onOpenProduct: (id: string) => void;
  onOpenCart: () => void;
  onOpenAccount: () => void;
}

const CATEGORIES = ["all", "disposables", "liquids", "pods", "accessories"] as const;
const SORTS = ["default", "price_asc", "price_desc", "best"] as const;
type SortKey = (typeof SORTS)[number];

export function Catalog({ onOpenProduct, onOpenCart, onOpenAccount }: CatalogProps) {
  const { t } = useLang();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("all");
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<ApiProduct[] | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("default");
  const [volumeFilter, setVolumeFilter] = useState<string>("all");

  const items = useCartStore((s) => s.items);
  const count = cartItemCount(items);
  const subtotal = cartSubtotalCents(items);

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(() => {
      fetchProducts({ category: category === "all" ? undefined : category, q: query || undefined })
        .then((rows) => !cancelled && setProducts(rows))
        .catch(() => !cancelled && setProducts([]));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [category, query]);

  const categoryLabel: Record<(typeof CATEGORIES)[number], string> = {
    all: t.all,
    disposables: t.disposables,
    liquids: t.liquids,
    pods: t.pods,
    accessories: t.accessories,
  };

  const sortLabel: Record<SortKey, string> = {
    default: t.sortDefault,
    price_asc: t.sortPriceAsc,
    price_desc: t.sortPriceDesc,
    best: t.sortBest,
  };

  const volumes = Array.from(new Set((products ?? []).map((p) => p.volumeMl).filter((v): v is number => v != null))).sort(
    (a, b) => a - b
  );

  const visibleProducts = (() => {
    let rows = products ?? [];
    if (volumeFilter !== "all") {
      const target = Number(volumeFilter);
      rows = rows.filter((p) => p.volumeMl === target);
    }
    rows = [...rows];
    if (sortBy === "price_asc") rows.sort((a, b) => a.priceCents - b.priceCents);
    else if (sortBy === "price_desc") rows.sort((a, b) => b.priceCents - a.priceCents);
    else if (sortBy === "best") rows.sort((a, b) => Number(b.bestSeller) - Number(a.bestSeller));
    return rows;
  })();

  return (
    <>
      <Header title="Smoke Finder" onClose={() => getWebApp()?.close()} onMenu={onOpenAccount} />
      <div className="sf-screen">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LogoWordmark />
          <span
            style={{
              marginLeft: "auto",
              font: "600 10px var(--font-body)",
              border: "1px solid var(--color-error)",
              color: "var(--color-error)",
              borderRadius: "var(--radius-sm)",
              padding: "3px 6px",
            }}
          >
            18+
          </span>
          <span onClick={onOpenAccount} style={{ font: "500 10px var(--font-body)", color: "var(--color-neutral-500)", cursor: "pointer" }}>
            Calgary, AB
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--color-neutral-900)", borderRadius: "var(--radius-md)", padding: "11px 13px" }}>
          <span style={{ fontSize: 14, color: "var(--color-neutral-500)" }}>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPh}
            style={{ background: "transparent", border: "none", outline: "none", color: "var(--color-text)", font: "400 13px var(--font-body)", flex: 1 }}
          />
        </div>

        <div style={{ display: "flex", gap: 7, overflowX: "auto" }}>
          {CATEGORIES.map((c) => (
            <span
              key={c}
              onClick={() => setCategory(c)}
              style={{
                flex: "none",
                padding: "7px 13px",
                borderRadius: 100,
                background: category === c ? "var(--sf-accent)" : "var(--color-neutral-900)",
                color: category === c ? "#1B0703" : "var(--color-text)",
                font: "600 12px var(--font-body)",
                cursor: "pointer",
              }}
            >
              {categoryLabel[c]}
            </span>
          ))}
        </div>

        <div style={{ display: "flex", gap: 7, alignItems: "center", font: "500 11.5px var(--font-body)" }}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            style={{
              padding: "6px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-neutral-700)",
              background: "var(--color-surface)",
              color: "var(--color-text)",
              font: "500 11.5px var(--font-body)",
            }}
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t.fType}: {sortLabel[s]}
              </option>
            ))}
          </select>
          {volumes.length > 0 && (
            <select
              value={volumeFilter}
              onChange={(e) => setVolumeFilter(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-neutral-700)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
                font: "500 11.5px var(--font-body)",
              }}
            >
              <option value="all">{t.fVolume}: {t.fVolumeAll}</option>
              {volumes.map((v) => (
                <option key={v} value={v}>
                  {t.fVolume}: {v} mL
                </option>
              ))}
            </select>
          )}
          <span style={{ marginLeft: "auto", color: "var(--color-neutral-500)", fontWeight: 400 }}>
            {products ? `${visibleProducts.length} ${t.nProducts.replace(/^\d+\s*/, "")}` : ""}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {products === null && <div style={{ color: "var(--color-neutral-500)", textAlign: "center", padding: 24 }}>{t.loading}</div>}
          {products && visibleProducts.length === 0 && (
            <div style={{ color: "var(--color-neutral-500)", textAlign: "center", padding: 24 }}>{t.noResults}</div>
          )}
          {visibleProducts.map((p) => (
            <ProductCard key={p.id} product={p} onOpen={() => onOpenProduct(p.id)} />
          ))}
        </div>
      </div>
      <ActionButton
        text={count > 0 ? t.cartCountLabel(count, formatCents(subtotal)) : t.emptyCart}
        onClick={onOpenCart}
        active={count > 0}
      />
    </>
  );
}
