import type { FastifyInstance } from "fastify";
import { db } from "../db/client.js";

interface ProductRow {
  id: string;
  category: string;
  name: string;
  flavour: string | null;
  price_cents: number;
  old_price_cents: number | null;
  badge: string | null;
  badge_bg: string | null;
  stock_state: string;
  stock_count: number | null;
  puffs: number | null;
  nicotine_mg: number;
  charging: string | null;
  volume_ml: number | null;
  best_seller: number;
  image_url: string | null;
  description_en: string | null;
  description_uk: string | null;
  description_ru: string | null;
  variant_label: string | null;
  points_price: number | null;
  is_new: number;
}

interface FlavourRow {
  product_id: string;
  name: string;
  sold_out: number;
  description_en: string | null;
  description_uk: string | null;
  description_ru: string | null;
}

const listStmt = db.prepare<[], ProductRow>(
  `SELECT * FROM products WHERE active = 1 ORDER BY sort_order ASC`
);
const getStmt = db.prepare<[string], ProductRow>(
  `SELECT * FROM products WHERE id = ? AND active = 1`
);
const flavoursStmt = db.prepare<[string], FlavourRow>(
  `SELECT * FROM product_flavours WHERE product_id = ? ORDER BY sort_order ASC`
);

function serialize(row: ProductRow) {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    flavour: row.flavour,
    priceCents: row.price_cents,
    oldPriceCents: row.old_price_cents,
    badge: row.badge,
    badgeBg: row.badge_bg,
    stockState: row.stock_state,
    stockCount: row.stock_count,
    puffs: row.puffs,
    nicotineMg: row.nicotine_mg,
    charging: row.charging,
    volumeMl: row.volume_ml,
    bestSeller: !!row.best_seller,
    imageUrl: row.image_url,
    descriptionEn: row.description_en,
    descriptionUk: row.description_uk,
    descriptionRu: row.description_ru,
    variantLabel: row.variant_label ?? "flavour",
    pointsPrice: row.points_price,
    isNew: !!row.is_new,
  };
}

export function registerProductRoutes(app: FastifyInstance) {
  app.get("/api/products", async (request) => {
    const { category, q } = request.query as { category?: string; q?: string };
    let rows = listStmt.all();
    if (category && category !== "all") {
      rows = rows.filter((r) => r.category === category);
    }
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(needle) ||
          (r.flavour ?? "").toLowerCase().includes(needle)
      );
    }
    return rows.map(serialize);
  });

  app.get("/api/products/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = getStmt.get(id);
    if (!row) {
      reply.code(404);
      return { error: "not_found" };
    }
    const flavours = flavoursStmt.all(id).map((f) => ({
      name: f.name,
      soldOut: !!f.sold_out,
      descriptionEn: f.description_en,
      descriptionUk: f.description_uk,
      descriptionRu: f.description_ru,
    }));
    return { ...serialize(row), flavours };
  });
}
