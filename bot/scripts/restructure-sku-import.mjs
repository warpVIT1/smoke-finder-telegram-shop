// NOT safely re-runnable once the catalog is already consolidated: it treats
// every $0 product row as raw "<model> - <flavour>" import data and re-groups
// it. Run this again ONLY straight after re-importing a fresh flat SKU sheet
// into `products` (one row per flavour, price_cents = 0) — running it against
// already-consolidated products (name has no " - <flavour>" suffix left) will
// wipe their product_flavours and recreate each as its own single-flavour
// "product". Run from `bot/`: `node scripts/restructure-sku-import.mjs`.
import Database from "better-sqlite3";
import { describeAny } from "./flavour-lexicon.mjs";
const db = new Database("smoke-finder.db");
db.pragma("foreign_keys = ON");

// Only touch the imported reference rows (price_cents = 0) — never the 6 real products.
const rows = db.prepare(`SELECT * FROM products WHERE price_cents = 0`).all();
console.log("Imported rows to restructure:", rows.length);

// Extract a clean "<N>K" puff-count token from the END of a name, e.g.
// "Insta Bar Mega Pro 160K" -> { clean: "Insta Bar Mega Pro", puffs: 160000 }.
// Deliberately conservative: only the unambiguous "<space>NNN K" pattern — fused
// tokens like "G100K"/"M85K" or bare numbers like "Mini 1200" are left alone
// rather than risk mis-parsing a spec that isn't actually a puff count.
function extractPuffs(name) {
  const m = /^(.*?)\s(\d{2,4})K\b(.*)$/.exec(name);
  if (!m) return { clean: name.trim(), puffs: null };
  const clean = (m[1] + m[3]).replace(/\s+/g, " ").trim();
  return { clean, puffs: Number(m[2]) * 1000 };
}

const groups = new Map();
for (const r of rows) {
  const base = r.name.split(" - ")[0].trim();
  const { clean, puffs } = extractPuffs(base);
  const key = [r.brand, clean, r.category, r.nicotine_mg].join("||");
  if (!groups.has(key)) {
    groups.set(key, {
      brand: r.brand,
      name: clean,
      category: r.category,
      nicotine_mg: r.nicotine_mg,
      puffs,
      cost_cents: r.cost_cents,
      sku: r.sku,
      flavours: [],
    });
  }
  const g = groups.get(key);
  const flavourName = r.flavour && r.flavour.trim() ? r.flavour.trim() : null;
  if (flavourName && !g.flavours.includes(flavourName)) g.flavours.push(flavourName);
}
console.log("Consolidated into", groups.size, "products");

function slugify(name) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "product"
  );
}

const existsStmt = db.prepare(`SELECT 1 FROM products WHERE id = ?`);
function uniqueId(name) {
  const base = slugify(name);
  if (!existsStmt.get(base)) return base;
  let n = 2;
  while (existsStmt.get(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

const deleteOldFlavours = db.prepare(`DELETE FROM product_flavours WHERE product_id IN (SELECT id FROM products WHERE price_cents = 0)`);
const deleteOldProducts = db.prepare(`DELETE FROM products WHERE price_cents = 0`);
const getMaxSort = db.prepare(`SELECT COALESCE(MAX(sort_order), -1) AS maxSort FROM products`);

const insertProduct = db.prepare(`
  INSERT INTO products
    (id, category, name, flavour, price_cents, old_price_cents, stock_state, stock_count,
     puffs, nicotine_mg, charging, volume_ml, best_seller, sort_order, active, brand, cost_cents, sku)
  VALUES
    (@id, @category, @name, NULL, 0, NULL, 'preorder', 0,
     @puffs, @nicotine_mg, NULL, NULL, 0, @sort_order, 0, @brand, @cost_cents, @sku)
`);
const insertFlavour = db.prepare(`
  INSERT INTO product_flavours (product_id, name, sold_out, sort_order, description_en, description_uk, description_ru)
  VALUES (@product_id, @name, 0, @sort_order, @description_en, @description_uk, @description_ru)
`);

const run = db.transaction(() => {
  deleteOldFlavours.run();
  deleteOldProducts.run();
  let sort = (getMaxSort.get() ?? { maxSort: -1 }).maxSort + 1;
  for (const g of groups.values()) {
    const id = uniqueId(`${g.brand}-${g.name}`);
    insertProduct.run({
      id,
      category: g.category,
      name: g.name,
      puffs: g.puffs,
      nicotine_mg: g.nicotine_mg,
      sort_order: sort++,
      brand: g.brand,
      cost_cents: g.cost_cents,
      sku: g.sku,
    });
    g.flavours.forEach((f, i) => {
      const desc = describeAny(f);
      insertFlavour.run({
        product_id: id,
        name: f,
        sort_order: i,
        description_en: desc?.en ?? null,
        description_uk: desc?.uk ?? null,
        description_ru: desc?.ru ?? null,
      });
    });
  }
});
run();

const finalCount = db.prepare(`SELECT COUNT(*) c FROM products`).get().c;
console.log("Final product count (6 real + consolidated):", finalCount);
