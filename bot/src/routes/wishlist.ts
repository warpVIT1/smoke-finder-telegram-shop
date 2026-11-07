import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/client.js";
import { verifyInitData, type TelegramWebAppUser } from "../lib/verifyInitData.js";

const getProductStmt = db.prepare<[string]>(`SELECT id, name, price_cents, image_url FROM products WHERE id = ?`);
// '' (not NULL) marks "no variant" — SQLite treats every NULL as distinct in a
// UNIQUE constraint, which would let the same no-variant product be inserted
// repeatedly; '' collapses those into one row like any other value would.
const insertWishlistStmt = db.prepare(`
  INSERT OR IGNORE INTO wishlist (telegram_id, product_id, flavour) VALUES (?, ?, ?)
`);
const listMineStmt = db.prepare(`
  SELECT w.id, w.product_id AS productId, w.flavour, w.created_at AS createdAt,
         p.name, p.price_cents AS priceCents, p.image_url AS imageUrl
  FROM wishlist w
  JOIN products p ON p.id = w.product_id
  WHERE w.telegram_id = ?
  ORDER BY w.created_at DESC
`);
const deleteMineStmt = db.prepare(`DELETE FROM wishlist WHERE id = ? AND telegram_id = ?`);
const setPaidStmt = db.prepare(`UPDATE wishlist SET paid = ? WHERE id = ?`);

const listForAdminStmt = db.prepare(`
  SELECT w.id, w.telegram_id AS telegramId, u.username AS username, u.first_name AS firstName,
         w.product_id AS productId, w.flavour AS flavour, w.created_at AS createdAt, w.paid AS paid,
         p.name AS name, p.brand AS brand, p.price_cents AS priceCents, p.image_url AS imageUrl
  FROM wishlist w
  JOIN products p ON p.id = w.product_id
  LEFT JOIN users u ON u.telegram_id = w.telegram_id
  ORDER BY p.brand ASC, p.name ASC, w.flavour ASC, w.created_at ASC
`);

interface AdminRow {
  id: number;
  telegramId: number;
  username: string | null;
  firstName: string | null;
  productId: string;
  flavour: string;
  createdAt: string;
  paid: number;
  name: string;
  brand: string | null;
  priceCents: number;
  imageUrl: string | null;
}

/**
 * The admin wishlist view needs two different slices of the same data:
 * - byProduct: a compact restocking summary (brand -> flavour -> how many want it)
 * - users: each customer's own full wishlist, shown when the admin taps their
 *   name in a byProduct group's wisher list, with a "mark paid" action per item.
 */
function buildAdminWishlistView(rows: AdminRow[]) {
  const byProductMap = new Map<
    string,
    { productId: string; name: string; brand: string | null; flavour: string | null; count: number; wishers: { telegramId: number; label: string }[] }
  >();
  const userMap = new Map<
    number,
    {
      telegramId: number;
      label: string;
      items: { id: number; productId: string; name: string; flavour: string | null; priceCents: number; imageUrl: string | null; createdAt: string; paid: boolean }[];
    }
  >();

  for (const r of rows) {
    const label = r.username ? `@${r.username}` : r.firstName ?? String(r.telegramId);

    const productKey = `${r.productId}::${r.flavour}`;
    if (!byProductMap.has(productKey)) {
      byProductMap.set(productKey, { productId: r.productId, name: r.name, brand: r.brand, flavour: r.flavour || null, count: 0, wishers: [] });
    }
    const productGroup = byProductMap.get(productKey)!;
    productGroup.count++;
    productGroup.wishers.push({ telegramId: r.telegramId, label });

    if (!userMap.has(r.telegramId)) {
      userMap.set(r.telegramId, { telegramId: r.telegramId, label, items: [] });
    }
    userMap.get(r.telegramId)!.items.push({
      id: r.id,
      productId: r.productId,
      name: r.name,
      flavour: r.flavour || null,
      priceCents: r.priceCents,
      imageUrl: r.imageUrl,
      createdAt: r.createdAt,
      paid: !!r.paid,
    });
  }

  return {
    byProduct: Array.from(byProductMap.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    users: Array.from(userMap.values()),
  };
}

function authenticate(request: FastifyRequest, reply: FastifyReply, botToken: string): TelegramWebAppUser | null {
  const initData = request.headers["x-telegram-init-data"];
  const verified = verifyInitData(typeof initData === "string" ? initData : "", botToken);
  if (!verified) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  return verified.user;
}

function requireAdmin(request: FastifyRequest, reply: FastifyReply, botToken: string, adminId: number): boolean {
  const user = authenticate(request, reply, botToken);
  if (!user) return false;
  if (user.id !== adminId) {
    reply.code(403).send({ error: "forbidden" });
    return false;
  }
  return true;
}

export function registerWishlistRoutes(app: FastifyInstance, botToken: string, adminId: number) {
  app.post("/api/wishlist", async (request, reply) => {
    const user = authenticate(request, reply, botToken);
    if (!user) return;
    const { productId, flavour } = request.body as { productId?: string; flavour?: string };
    if (!productId || !getProductStmt.get(productId)) {
      reply.code(400);
      return { error: "unknown_product" };
    }
    insertWishlistStmt.run(user.id, productId, flavour?.trim() || "");
    reply.code(204);
  });

  app.get("/api/wishlist/mine", async (request, reply) => {
    const user = authenticate(request, reply, botToken);
    if (!user) return;
    const rows = listMineStmt.all(user.id) as {
      id: number;
      productId: string;
      flavour: string;
      createdAt: string;
      name: string;
      priceCents: number;
      imageUrl: string | null;
    }[];
    return rows.map((r) => ({
      id: r.id,
      productId: r.productId,
      flavour: r.flavour || null,
      name: r.name,
      priceCents: r.priceCents,
      imageUrl: r.imageUrl,
      createdAt: r.createdAt,
    }));
  });

  app.delete("/api/wishlist/:id", async (request, reply) => {
    const user = authenticate(request, reply, botToken);
    if (!user) return;
    const { id } = request.params as { id: string };
    deleteMineStmt.run(Number(id), user.id);
    reply.code(204);
  });

  app.get("/api/admin/wishlist", async (request, reply) => {
    if (!requireAdmin(request, reply, botToken, adminId)) return;
    return buildAdminWishlistView(listForAdminStmt.all() as AdminRow[]);
  });

  // Toggles a wishlist item's "paid" flag — purely a note for the admin
  // (e.g. the customer prepaid for it), the item stays in the list either way.
  app.patch("/api/admin/wishlist/:id", async (request, reply) => {
    if (!requireAdmin(request, reply, botToken, adminId)) return;
    const { id } = request.params as { id: string };
    const { paid } = request.body as { paid?: boolean };
    setPaidStmt.run(paid ? 1 : 0, Number(id));
    reply.code(204);
  });
}

export { listForAdminStmt, buildAdminWishlistView, setPaidStmt };
export type { AdminRow as WishlistAdminRow };
