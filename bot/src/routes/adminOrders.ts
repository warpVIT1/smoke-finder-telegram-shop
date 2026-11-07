import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/client.js";
import { verifyInitData } from "../lib/verifyInitData.js";

/**
 * Mobile counterpart to the local-only admin/ tool's order management — reachable
 * through Telegram via the hidden admin command + `?admin=1` mini app, for checking
 * orders and confirming e-Transfer payments on the go. Every request re-validates
 * the Telegram initData signature AND that the user id is the configured admin —
 * never trust that only the admin could have reached this URL.
 */

const ORDER_STATUSES = ["placed", "accepted", "packed", "ready_pickup", "delivered", "cancelled"] as const;

const listOrdersStmt = db.prepare(`
  SELECT o.*, u.first_name AS user_first_name, u.username AS user_username
  FROM orders o
  LEFT JOIN users u ON u.telegram_id = o.telegram_id
  ORDER BY o.created_at DESC
  LIMIT 100
`);
const listOrderItemsWithNamesStmt = db.prepare(`
  SELECT oi.*, p.name AS product_name
  FROM order_items oi
  LEFT JOIN products p ON p.id = oi.product_id
  WHERE oi.order_id = ?
`);
const setOrderStatusStmt = db.prepare(`UPDATE orders SET status = ? WHERE id = ?`);
const orderExistsStmt = db.prepare<[number]>(`SELECT 1 FROM orders WHERE id = ?`);

function requireAdmin(request: FastifyRequest, reply: FastifyReply, botToken: string, adminId: number): boolean {
  const initData = request.headers["x-telegram-init-data"];
  const verified = verifyInitData(typeof initData === "string" ? initData : "", botToken);
  if (!verified || verified.user.id !== adminId) {
    reply.code(403).send({ error: "forbidden" });
    return false;
  }
  return true;
}

export function registerAdminOrderRoutes(app: FastifyInstance, botToken: string, adminId: number) {
  app.get("/api/admin/orders", async (request, reply) => {
    if (!requireAdmin(request, reply, botToken, adminId)) return;
    const orders = listOrdersStmt.all() as any[];
    return orders.map((o) => ({
      id: o.id,
      telegramId: o.telegram_id,
      customerName: o.user_first_name ?? o.contact_name ?? null,
      customerUsername: o.user_username ?? null,
      status: o.status,
      deliveryMethod: o.delivery_method,
      paymentMethod: o.payment_method,
      contactPhone: o.contact_phone,
      address: o.address,
      totalCents: o.total_cents,
      createdAt: o.created_at,
      paymentConfirmed: !!o.payment_confirmed,
      hasPaymentProof: !!o.payment_proof_file_id,
      items: (listOrderItemsWithNamesStmt.all(o.id) as any[]).map((i) => ({
        name: i.product_name ?? i.product_id,
        flavour: i.flavour,
        qty: i.qty,
        unitPriceCents: i.unit_price_cents,
      })),
    }));
  });

  app.patch("/api/admin/orders/:id/status", async (request, reply) => {
    if (!requireAdmin(request, reply, botToken, adminId)) return;
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
