import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { db, imagesDir } from "../db/client.js";
import { listForAdminStmt, buildAdminWishlistView, setPaidStmt, type WishlistAdminRow } from "./wishlist.js";

/**
 * API for the local-only admin/ tool (127.0.0.1, this machine) to manage the
 * shop's live data over https instead of touching a local SQLite file — the
 * bot now runs on a remote server, so a local file was never the live data.
 * Gated by a static shared secret (LOCAL_ADMIN_SECRET), not Telegram initData,
 * since this is a plain server-to-server call with no Telegram user context.
 */

interface ProductRow {
  id: string;
  category: string;
  name: string;
  flavour: string | null;
  price_cents: number;
  old_price_cents: number | null;
  stock_state: string;
  stock_count: number | null;
  puffs: number | null;
  nicotine_mg: number;
  charging: string | null;
  volume_ml: number | null;
  best_seller: number;
  active: number;
  image_url: string | null;
  brand: string | null;
  cost_cents: number | null;
  sku: string | null;
  description_en: string | null;
  description_uk: string | null;
  description_ru: string | null;
  variant_label: string | null;
  points_price: number | null;
  is_new: number;
}

interface FlavourRow {
  id: number;
  product_id: string;
  name: string;
  sold_out: number;
  sort_order: number;
  stock_count: number | null;
  description_en: string | null;
  description_uk: string | null;
  description_ru: string | null;
}

interface CreateProductBody {
  name: string;
  category: string;
  priceCents: number;
  oldPriceCents?: number;
  flavour?: string;
  nicotineMg?: number;
  stockCount?: number;
  puffs?: number;
  charging?: string;
  volumeMl?: number;
  bestSeller?: boolean;
  isNew?: boolean;
  brand?: string;
  costCents?: number;
  sku?: string;
  descriptionEn?: string;
  descriptionUk?: string;
  descriptionRu?: string;
  pointsPrice?: number;
  imageBase64?: string;
  imageFileName?: string;
}

interface UpdateProductBody {
  name?: string;
  category?: string;
  priceCents?: number;
  oldPriceCents?: number | null;
  flavour?: string | null;
  nicotineMg?: number;
  stockCount?: number;
  charging?: string | null;
  volumeMl?: number | null;
  bestSeller?: boolean;
  isNew?: boolean;
  brand?: string | null;
  costCents?: number | null;
  descriptionEn?: string | null;
  descriptionUk?: string | null;
  descriptionRu?: string | null;
  variantLabel?: string;
  pointsPrice?: number | null;
  imageBase64?: string;
  imageFileName?: string;
}

/** Exact unit count in stock drives the state — no separate manual dropdown to keep in sync. */
function deriveStockState(count: number): "in_stock" | "low" | "preorder" {
  if (count <= 0) return "preorder";
  if (count <= 5) return "low";
  return "in_stock";
}

const IMAGE_EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function saveProductImage(productId: string, dataUrl: string, fileName?: string): string | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const [, mime, base64] = match;
  const extFromName = fileName?.includes(".") ? fileName.split(".").pop() : undefined;
  const ext = extFromName || IMAGE_EXT_BY_MIME[mime] || "jpg";
  const filename = `${productId}.${ext}`;
  writeFileSync(join(imagesDir, filename), Buffer.from(base64, "base64"));
  return `/images/${filename}`;
}

const listProductsStmt = db.prepare<[], ProductRow>(`SELECT * FROM products ORDER BY sort_order DESC`);
const getProductByIdStmt = db.prepare<[string], ProductRow>(`SELECT * FROM products WHERE id = ?`);
const getMaxSortStmt = db.prepare(`SELECT COALESCE(MAX(sort_order), -1) AS maxSort FROM products`);
const productExistsStmt = db.prepare<[string]>(`SELECT 1 FROM products WHERE id = ?`);
const insertProductStmt = db.prepare(`
  INSERT INTO products
    (id, category, name, flavour, price_cents, old_price_cents, stock_state, stock_count,
     puffs, nicotine_mg, charging, volume_ml, best_seller, sort_order, active, image_url,
     brand, cost_cents, sku, description_en, description_uk, description_ru, points_price, is_new)
  VALUES
    (@id, @category, @name, @flavour, @price_cents, @old_price_cents, @stock_state, @stock_count,
     @puffs, @nicotine_mg, @charging, @volume_ml, @best_seller, @sort_order, 1, @image_url,
     @brand, @cost_cents, @sku, @description_en, @description_uk, @description_ru, @points_price, @is_new)
`);
const setProductActiveStmt = db.prepare(`UPDATE products SET active = ? WHERE id = ?`);

/** [request body key, db column, value transform] — used to build a partial UPDATE. */
const UPDATE_FIELD_MAP: [keyof UpdateProductBody, string, (v: any) => unknown][] = [
  ["name", "name", (v) => String(v).trim()],
  ["category", "category", (v) => v],
  ["priceCents", "price_cents", (v) => Math.round(v)],
  ["oldPriceCents", "old_price_cents", (v) => (v == null ? null : Math.round(v))],
  ["flavour", "flavour", (v) => (v ? String(v).trim() : null)],
  ["nicotineMg", "nicotine_mg", (v) => v],
  ["charging", "charging", (v) => (v ? String(v).trim() : null)],
  ["volumeMl", "volume_ml", (v) => v],
  ["bestSeller", "best_seller", (v) => (v ? 1 : 0)],
  ["isNew", "is_new", (v) => (v ? 1 : 0)],
  ["brand", "brand", (v) => (v ? String(v).trim() : null)],
  ["costCents", "cost_cents", (v) => (v == null ? null : Math.round(v))],
  ["descriptionEn", "description_en", (v) => v ?? null],
  ["descriptionUk", "description_uk", (v) => v ?? null],
  ["descriptionRu", "description_ru", (v) => v ?? null],
  ["variantLabel", "variant_label", (v) => v],
  ["pointsPrice", "points_price", (v) => (v == null ? null : Math.round(v))],
];

function serializeProduct(row: ProductRow) {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    flavour: row.flavour,
    priceCents: row.price_cents,
    oldPriceCents: row.old_price_cents,
    stockState: row.stock_state,
    stockCount: row.stock_count,
    puffs: row.puffs,
    nicotineMg: row.nicotine_mg,
    charging: row.charging,
    volumeMl: row.volume_ml,
    bestSeller: !!row.best_seller,
    active: !!row.active,
    imageUrl: row.image_url,
    brand: row.brand,
    costCents: row.cost_cents,
    sku: row.sku,
    descriptionEn: row.description_en,
    descriptionUk: row.description_uk,
    descriptionRu: row.description_ru,
    variantLabel: row.variant_label ?? "flavour",
    pointsPrice: row.points_price,
    isNew: !!row.is_new,
  };
}

function slugify(name: string): string {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base || "product";
}

function uniqueProductId(name: string): string {
  const base = slugify(name);
  if (!productExistsStmt.get(base)) return base;
  let suffix = 2;
  while (productExistsStmt.get(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
}

interface VariantBody {
  name: string;
  stockCount?: number;
  soldOut?: boolean;
  descriptionEn?: string | null;
  descriptionUk?: string | null;
  descriptionRu?: string | null;
}

const listFlavoursStmt = db.prepare<[string], FlavourRow>(
  `SELECT * FROM product_flavours WHERE product_id = ? ORDER BY sort_order ASC`
);
const deleteFlavoursStmt = db.prepare(`DELETE FROM product_flavours WHERE product_id = ?`);
const insertFlavourStmt = db.prepare(`
  INSERT INTO product_flavours (product_id, name, sold_out, sort_order, stock_count, description_en, description_uk, description_ru)
  VALUES (@product_id, @name, @sold_out, @sort_order, @stock_count, @description_en, @description_uk, @description_ru)
`);
const sumVariantStockStmt = db.prepare<[string], { total: number }>(
  `SELECT COALESCE(SUM(stock_count), 0) AS total FROM product_flavours WHERE product_id = ?`
);
const updateProductStockStmt = db.prepare(`UPDATE products SET stock_count = ?, stock_state = ? WHERE id = ?`);

function serializeVariant(row: FlavourRow) {
  return {
    id: row.id,
    name: row.name,
    soldOut: !!row.sold_out,
    stockCount: row.stock_count ?? 0,
    descriptionEn: row.description_en,
    descriptionUk: row.description_uk,
    descriptionRu: row.description_ru,
  };
}

const REFERRAL_REWARD_EVERY = 15;

const listUsersStmt = db.prepare(`
  SELECT u.*, (SELECT COUNT(*) FROM users r WHERE r.referred_by = u.telegram_id) AS referral_count
  FROM users u
  ORDER BY u.member_since DESC
`);
const userExistsForRedeemStmt = db.prepare<[number]>(`SELECT rewards_redeemed FROM users WHERE telegram_id = ?`);
const redeemRewardStmt = db.prepare(`UPDATE users SET rewards_redeemed = rewards_redeemed + 1 WHERE telegram_id = ?`);
const setUserDiscountStmt = db.prepare(`UPDATE users SET discount_percent = ? WHERE telegram_id = ?`);
const listAddressesStmt = db.prepare(`
  SELECT a.*, u.first_name AS user_first_name, u.username AS user_username
  FROM addresses a
  LEFT JOIN users u ON u.telegram_id = a.telegram_id
  ORDER BY a.created_at DESC
`);

function requireSecret(request: FastifyRequest, reply: FastifyReply, secret: string): boolean {
  const provided = request.headers["x-admin-secret"];
  if (provided !== secret) {
    reply.code(403).send({ error: "forbidden" });
    return false;
  }
  return true;
}

export function registerLocalAdminRoutes(app: FastifyInstance, secret: string) {
  app.addHook("onRequest", async (request, reply) => {
    if (request.url.startsWith("/api/local-admin/")) {
      requireSecret(request, reply, secret);
    }
  });

  // products
  app.get("/api/local-admin/products", async () => listProductsStmt.all().map(serializeProduct));

  app.post("/api/local-admin/products", async (request, reply) => {
    const body = request.body as CreateProductBody;
    if (!body?.name?.trim() || !body.category || !Number.isFinite(body.priceCents) || body.priceCents <= 0) {
      reply.code(400);
      return { error: "invalid_product" };
    }
    const id = uniqueProductId(body.name.trim());
    const maxSort = (getMaxSortStmt.get() as { maxSort: number }).maxSort;
    const stockCount = Math.max(0, Math.round(body.stockCount ?? 0));
    const imageUrl = body.imageBase64 ? saveProductImage(id, body.imageBase64, body.imageFileName) : null;
    insertProductStmt.run({
      id,
      category: body.category,
      name: body.name.trim(),
      flavour: body.flavour?.trim() || null,
      price_cents: Math.round(body.priceCents),
      old_price_cents: body.oldPriceCents ? Math.round(body.oldPriceCents) : null,
      stock_state: deriveStockState(stockCount),
      stock_count: stockCount,
      puffs: body.puffs ?? null,
      nicotine_mg: body.nicotineMg ?? 0,
      charging: body.charging?.trim() || null,
      volume_ml: body.volumeMl ?? null,
      best_seller: body.bestSeller ? 1 : 0,
      sort_order: maxSort + 1,
      image_url: imageUrl,
      brand: body.brand?.trim() || null,
      cost_cents: body.costCents ?? null,
      sku: body.sku ?? null,
      description_en: body.descriptionEn ?? null,
      description_uk: body.descriptionUk ?? null,
      description_ru: body.descriptionRu ?? null,
      points_price: body.pointsPrice ?? null,
      is_new: body.isNew ? 1 : 0,
    });
    reply.code(201);
    return serializeProduct(getProductByIdStmt.get(id) as ProductRow);
  });

  app.delete("/api/local-admin/products/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    setProductActiveStmt.run(0, id);
    reply.code(204);
  });

  app.post("/api/local-admin/products/:id/restore", async (request, reply) => {
    const { id } = request.params as { id: string };
    setProductActiveStmt.run(1, id);
    reply.code(204);
  });

  app.patch("/api/local-admin/products/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!getProductByIdStmt.get(id)) {
      reply.code(404);
      return { error: "not_found" };
    }
    const body = request.body as UpdateProductBody;

    const sets: string[] = [];
    const params: Record<string, unknown> = { id };
    for (const [bodyKey, column, transform] of UPDATE_FIELD_MAP) {
      const value = body[bodyKey];
      if (value !== undefined) {
        sets.push(`${column} = @${column}`);
        params[column] = transform(value);
      }
    }
    if (body.stockCount !== undefined) {
      const stockCount = Math.max(0, Math.round(body.stockCount));
      sets.push(`stock_count = @stock_count`, `stock_state = @stock_state`);
      params.stock_count = stockCount;
      params.stock_state = deriveStockState(stockCount);
    }
    if (body.imageBase64) {
      const imageUrl = saveProductImage(id, body.imageBase64, body.imageFileName);
      if (imageUrl) {
        sets.push(`image_url = @image_url`);
        params.image_url = imageUrl;
      }
    }
    if (sets.length) {
      db.prepare(`UPDATE products SET ${sets.join(", ")} WHERE id = @id`).run(params);
    }
    return serializeProduct(getProductByIdStmt.get(id) as ProductRow);
  });

  app.get("/api/local-admin/products/:id/variants", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!getProductByIdStmt.get(id)) {
      reply.code(404);
      return { error: "not_found" };
    }
    return listFlavoursStmt.all(id).map(serializeVariant);
  });

  // Full replace, not per-row CRUD — the admin UI always edits the whole
  // variant list (name + qty) together and saves it in one shot.
  app.put("/api/local-admin/products/:id/variants", async (request, reply) => {
    const { id } = request.params as { id: string };
    const product = getProductByIdStmt.get(id);
    if (!product) {
      reply.code(404);
      return { error: "not_found" };
    }
    const body = request.body as { variants?: VariantBody[] };
    if (!Array.isArray(body?.variants)) {
      reply.code(400);
      return { error: "invalid_variants" };
    }
    // Only ohm/colour variants get real per-unit quantity tracking — flavour
    // rows never had per-flavour counts entered, so deriving sold_out from
    // stockCount<=0 for them would mark every flavour "sold out" the moment
    // anyone saves the product at all. For flavours, sold_out is purely the
    // admin's explicit toggle.
    const tracksStock = product.variant_label === "colour" || product.variant_label === "ohm";
    const tx = db.transaction(() => {
      deleteFlavoursStmt.run(id);
      body.variants!.forEach((v, i) => {
        const name = String(v.name ?? "").trim();
        if (!name) return;
        const stockCount = Math.max(0, Math.round(v.stockCount ?? 0));
        insertFlavourStmt.run({
          product_id: id,
          name,
          sold_out: v.soldOut || (tracksStock && stockCount <= 0) ? 1 : 0,
          sort_order: i,
          stock_count: stockCount,
          description_en: v.descriptionEn ?? null,
          description_uk: v.descriptionUk ?? null,
          description_ru: v.descriptionRu ?? null,
        });
      });
      if (tracksStock && body.variants!.some((v) => String(v.name ?? "").trim())) {
        const total = sumVariantStockStmt.get(id)!.total;
        updateProductStockStmt.run(total, deriveStockState(total), id);
      }
    });
    tx();
    return {
      variants: listFlavoursStmt.all(id).map(serializeVariant),
      product: serializeProduct(getProductByIdStmt.get(id) as ProductRow),
    };
  });

  // users
  app.get("/api/local-admin/users", async () => {
    const users = listUsersStmt.all() as any[];
    return users.map((u) => {
      const earnedRewards = Math.floor(u.referral_count / REFERRAL_REWARD_EVERY);
      return {
        telegramId: u.telegram_id,
        firstName: u.first_name,
        username: u.username,
        language: u.language,
        phone: u.phone,
        points: u.points,
        memberSince: u.member_since,
        referralCount: u.referral_count,
        rewardsEarned: earnedRewards,
        rewardsRedeemed: u.rewards_redeemed,
        rewardsAvailable: Math.max(0, earnedRewards - u.rewards_redeemed),
        discountPercent: u.discount_percent,
      };
    });
  });

  app.post("/api/local-admin/users/:id/redeem-reward", async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = userExistsForRedeemStmt.get(Number(id)) as { rewards_redeemed: number } | undefined;
    if (!row) {
      reply.code(404);
      return { error: "not_found" };
    }
    redeemRewardStmt.run(id);
    reply.code(204);
  });

  app.patch("/api/local-admin/users/:id/discount", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { discountPercent } = request.body as { discountPercent?: number };
    if (!Number.isFinite(discountPercent) || discountPercent! < 0 || discountPercent! > 100) {
      reply.code(400);
      return { error: "invalid_discount" };
    }
    const result = setUserDiscountStmt.run(Math.round(discountPercent!), id);
    if (result.changes === 0) {
      reply.code(404);
      return { error: "not_found" };
    }
    reply.code(204);
  });

  // wishlist
  app.get("/api/local-admin/wishlist", async () => buildAdminWishlistView(listForAdminStmt.all() as WishlistAdminRow[]));

  // Toggles a wishlist item's "paid" flag — purely a note for the admin
  // (e.g. the customer prepaid for it), the item stays in the list either way.
  app.patch("/api/local-admin/wishlist/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { paid } = request.body as { paid?: boolean };
    setPaidStmt.run(paid ? 1 : 0, Number(id));
    reply.code(204);
  });

  // addresses
  app.get("/api/local-admin/addresses", async () => {
    const rows = listAddressesStmt.all() as any[];
    return rows.map((a) => ({
      id: a.id,
      telegramId: a.telegram_id,
      customerName: a.user_first_name ?? null,
      customerUsername: a.user_username ?? null,
      address: a.address,
      createdAt: a.created_at,
    }));
  });

  // orders — same data/shape as the mobile admin's /api/admin/orders, but
  // reachable from the local tool via the shared secret instead of Telegram auth.
  const ORDER_STATUSES = ["placed", "accepted", "packed", "ready_pickup", "delivered", "cancelled"] as const;
  const listOrdersStmt = db.prepare(`
    SELECT o.*, u.first_name AS user_first_name, u.username AS user_username
    FROM orders o
    LEFT JOIN users u ON u.telegram_id = o.telegram_id
    ORDER BY o.created_at DESC
  `);
  const listOrderItemsWithNamesStmt = db.prepare(`
    SELECT oi.*, p.name AS product_name
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
  `);
  const setOrderStatusStmt = db.prepare(`UPDATE orders SET status = ? WHERE id = ?`);
  const orderExistsStmt = db.prepare<[number]>(`SELECT 1 FROM orders WHERE id = ?`);

  app.get("/api/local-admin/orders", async () => {
    const orders = listOrdersStmt.all() as any[];
    return orders.map((o) => ({
      id: o.id,
      telegramId: o.telegram_id,
      customerName: o.user_first_name ?? o.contact_name ?? null,
      customerUsername: o.user_username ?? null,
      status: o.status,
      deliveryMethod: o.delivery_method,
      paymentMethod: o.payment_method,
      contactName: o.contact_name,
      contactPhone: o.contact_phone,
      address: o.address,
      subtotalCents: o.subtotal_cents,
      shippingCents: o.shipping_cents,
      taxCents: o.tax_cents,
      totalCents: o.total_cents,
      promoCode: o.promo_code,
      createdAt: o.created_at,
      paymentConfirmed: !!o.payment_confirmed,
      hasPaymentProof: !!o.payment_proof_file_id,
      items: (listOrderItemsWithNamesStmt.all(o.id) as any[]).map((i) => ({
        productId: i.product_id,
        name: i.product_name ?? i.product_id,
        flavour: i.flavour,
        qty: i.qty,
        unitPriceCents: i.unit_price_cents,
      })),
    }));
  });

  app.patch("/api/local-admin/orders/:id/status", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status?: string };
    if (!status || !ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number])) {
      reply.code(400);
      return { error: "invalid_status" };
    }
    if (!orderExistsStmt.get(Number(id))) {
      reply.code(404);
      return { error: "not_found" };
    }
    setOrderStatusStmt.run(status, id);
    reply.code(204);
  });
}
