import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { InlineKeyboard } from "grammy";
import { db } from "../db/client.js";
import { verifyInitData, type TelegramWebAppUser } from "../lib/verifyInitData.js";
import { calcTotals, type CartLine } from "../lib/pricing.js";
import { buildOrderMessage, buildGroupOrderMessage } from "../lib/orderMessage.js";
import { createWalletPayOrder } from "../lib/walletPay.js";

interface BotApiLike {
  sendMessage(chatId: number, text: string, extra?: { reply_markup?: InlineKeyboard }): Promise<unknown>;
}

interface OrderItemInput {
  productId: string;
  flavour?: string;
  qty: number;
}

interface CreateOrderBody {
  items: OrderItemInput[];
  deliveryMethod: "courier" | "pickup";
  paymentMethod: "e_transfer" | "cash" | "wallet_pay" | "points";
  contactName?: string;
  contactPhone?: string;
  address?: string;
  promoCode?: string;
}

/** Orders with a subtotal (before tax/shipping) of at least this many cents
 * count toward the "every 5 qualifying purchases" loyalty rule. */
const QUALIFYING_PURCHASE_SUBTOTAL_CENTS = 10000; // $100 CAD
const PURCHASES_PER_POINT_BATCH = 5;
const POINTS_PER_PURCHASE_BATCH = 1.5;

const getUserLanguageStmt = db.prepare<[number]>(`SELECT language FROM users WHERE telegram_id = ?`);

const upsertUserStmt = db.prepare(`
  INSERT INTO users (telegram_id, first_name, username, language, phone)
  VALUES (@id, @first_name, @username, @language, @phone)
  ON CONFLICT(telegram_id) DO UPDATE SET
    first_name = excluded.first_name,
    username = excluded.username,
    phone = excluded.phone
`);

const CANADA_PHONE_RE = /^\+1\d{10}$/;

const getProductStmt = db.prepare<[string]>(`SELECT id, name, price_cents, points_price FROM products WHERE id = ?`);
const getUserPointsStmt = db.prepare<[number]>(`SELECT points FROM users WHERE telegram_id = ?`);
const getUserDiscountStmt = db.prepare<[number]>(`SELECT discount_percent FROM users WHERE telegram_id = ?`);
const addPointsStmt = db.prepare(`UPDATE users SET points = points + ? WHERE telegram_id = ?`);
const countQualifyingOrdersStmt = db.prepare<[number, number], { c: number }>(
  `SELECT COUNT(*) c FROM orders WHERE telegram_id = ? AND subtotal_cents >= ?`
);

const insertOrderStmt = db.prepare(`
  INSERT INTO orders
    (telegram_id, delivery_method, payment_method, contact_name, contact_phone, address,
     subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents, promo_code)
  VALUES
    (@telegram_id, @delivery_method, @payment_method, @contact_name, @contact_phone, @address,
     @subtotal_cents, @discount_cents, @shipping_cents, @tax_cents, @total_cents, @promo_code)
`);

const insertOrderItemStmt = db.prepare(`
  INSERT INTO order_items (order_id, product_id, flavour, qty, unit_price_cents)
  VALUES (@order_id, @product_id, @flavour, @qty, @unit_price_cents)
`);

const setWalletPayFieldsStmt = db.prepare(`
  UPDATE orders SET wallet_pay_order_id = ?, wallet_pay_pay_link = ? WHERE id = ?
`);

const listOrdersStmt = db.prepare(`
  SELECT * FROM orders WHERE telegram_id = ? ORDER BY created_at DESC
`);

const listOrderItemsStmt = db.prepare(`
  SELECT * FROM order_items WHERE order_id = ?
`);

function authenticate(request: FastifyRequest, reply: FastifyReply, botToken: string): TelegramWebAppUser | null {
  const initData = request.headers["x-telegram-init-data"];
  const verified = verifyInitData(typeof initData === "string" ? initData : "", botToken);
  if (!verified) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  return verified.user;
}

export function registerOrderRoutes(
  app: FastifyInstance,
  botToken: string,
  botApi: BotApiLike,
  orderGroupId?: number,
  walletPayApiKey?: string
) {
  app.post("/api/orders", async (request, reply) => {
    const user = authenticate(request, reply, botToken);
    if (!user) return;

    const body = request.body as CreateOrderBody;
    if (!body?.items?.length) {
      reply.code(400);
      return { error: "empty_cart" };
    }
    if (!body.contactPhone || !CANADA_PHONE_RE.test(body.contactPhone)) {
      reply.code(400);
      return { error: "invalid_phone" };
    }
    if (body.deliveryMethod === "courier" && !body.address?.trim()) {
      reply.code(400);
      return { error: "address_required" };
    }
    if (body.paymentMethod === "wallet_pay" && !walletPayApiKey) {
      reply.code(400);
      return { error: "wallet_pay_unavailable" };
    }

    upsertUserStmt.run({
      id: user.id,
      first_name: user.first_name ?? null,
      username: user.username ?? null,
      language: user.language_code ?? "en",
      phone: body.contactPhone,
    });

    const lines: CartLine[] = [];
    const resolvedItems: (OrderItemInput & { unitPriceCents: number; name: string; pointsPrice: number | null })[] = [];
    let totalPointsCost = 0;
    for (const item of body.items) {
      const product = getProductStmt.get(item.productId) as
        | { id: string; name: string; price_cents: number; points_price: number | null }
        | undefined;
      if (!product) {
        reply.code(400);
        return { error: "unknown_product", productId: item.productId };
      }
      lines.push({ unitPriceCents: product.price_cents, qty: item.qty });
      resolvedItems.push({ ...item, unitPriceCents: product.price_cents, name: product.name, pointsPrice: product.points_price });
      totalPointsCost += (product.points_price ?? 0) * item.qty;
    }

    // Paying with points: every item in the cart must have a points price
    // set by the admin, and the customer's balance must cover the total.
    if (body.paymentMethod === "points") {
      if (resolvedItems.some((i) => i.pointsPrice == null)) {
        reply.code(400);
        return { error: "points_not_available" };
      }
      const balance = (getUserPointsStmt.get(user.id) as { points: number } | undefined)?.points ?? 0;
      if (balance < totalPointsCost) {
        reply.code(400);
        return { error: "insufficient_points" };
      }
    }

    const discountPercent = (getUserDiscountStmt.get(user.id) as { discount_percent: number } | undefined)?.discount_percent ?? 0;
    const totals =
      body.paymentMethod === "points"
        ? { ...calcTotals(lines, body.deliveryMethod, discountPercent), totalCents: 0 }
        : calcTotals(lines, body.deliveryMethod, discountPercent);

    const orderId = db.transaction(() => {
      const result = insertOrderStmt.run({
        telegram_id: user.id,
        delivery_method: body.deliveryMethod,
        payment_method: body.paymentMethod,
        contact_name: body.contactName ?? null,
        contact_phone: body.contactPhone ?? null,
        address: body.address ?? null,
        subtotal_cents: totals.subtotalCents,
        discount_cents: totals.discountCents,
        shipping_cents: totals.shippingCents,
        tax_cents: totals.taxCents,
        total_cents: totals.totalCents,
        promo_code: body.promoCode ?? null,
      });
      const newOrderId = result.lastInsertRowid;
      if (body.paymentMethod === "points") {
        addPointsStmt.run(-totalPointsCost, user.id);
      }
      // Loyalty rule: every 5th order with a subtotal of $100+ (tax/shipping
      // excluded) earns 1.5 points — independent of how this order itself was paid.
      if (totals.subtotalCents >= QUALIFYING_PURCHASE_SUBTOTAL_CENTS) {
        const qualifyingCount = countQualifyingOrdersStmt.get(user.id, QUALIFYING_PURCHASE_SUBTOTAL_CENTS)!.c + 1;
        if (qualifyingCount % PURCHASES_PER_POINT_BATCH === 0) {
          addPointsStmt.run(POINTS_PER_PURCHASE_BATCH, user.id);
        }
      }
      for (const item of resolvedItems) {
        insertOrderItemStmt.run({
          order_id: newOrderId,
          product_id: item.productId,
          flavour: item.flavour ?? null,
          qty: item.qty,
          unit_price_cents: item.unitPriceCents,
        });
      }
      return newOrderId;
    })();

    let walletPayLink: string | undefined;
    if (body.paymentMethod === "wallet_pay" && walletPayApiKey) {
      try {
        const wpOrder = await createWalletPayOrder(walletPayApiKey, {
          amountUsd: totals.totalCents / 100,
          description: `Smoke Finder order #${orderId}`,
          externalId: `order-${orderId}`,
          customerTelegramUserId: user.id,
          timeoutSeconds: 1800,
        });
        setWalletPayFieldsStmt.run(String(wpOrder.id), wpOrder.directPayLink, orderId);
        walletPayLink = wpOrder.directPayLink;
      } catch (err) {
        app.log.error({ err, orderId }, "Failed to create Wallet Pay order");
        reply.code(502);
        return { error: "wallet_pay_failed" };
      }
    }

    // Prefer whatever language the customer last picked in the mini app's
    // switcher (persisted to users.language) over Telegram's client
    // language_code, which is a different, independent setting.
    const storedLanguage = (getUserLanguageStmt.get(user.id) as { language: string | null } | undefined)?.language;
    const message = buildOrderMessage(storedLanguage ?? user.language_code ?? "en", {
      orderId,
      items: resolvedItems.map((i) => ({
        name: i.name,
        flavour: i.flavour ?? null,
        qty: i.qty,
        unitPriceCents: i.unitPriceCents,
      })),
      deliveryMethod: body.deliveryMethod,
      paymentMethod: body.paymentMethod,
      address: body.address ?? null,
      ...totals,
    });
    // Design guideline from docs.wallet.tg/pay: the pay button must be
    // labelled exactly "💰 Wallet Pay" or "💰 Pay via Wallet" and sit above
    // any other buttons — there are none here, so this is the whole keyboard.
    const customerExtra = walletPayLink ? { reply_markup: new InlineKeyboard().url("💰 Wallet Pay", walletPayLink) } : undefined;
    botApi.sendMessage(user.id, message, customerExtra).catch((err) => {
      app.log.error({ err, orderId }, "Failed to send order confirmation message");
    });

    if (orderGroupId) {
      const groupMessage = buildGroupOrderMessage({
        orderId,
        items: resolvedItems.map((i) => ({
          name: i.name,
          flavour: i.flavour ?? null,
          qty: i.qty,
          unitPriceCents: i.unitPriceCents,
        })),
        deliveryMethod: body.deliveryMethod,
        paymentMethod: body.paymentMethod,
        address: body.address ?? null,
        customerLang: storedLanguage ?? user.language_code ?? "en",
        customerName: user.first_name ?? null,
        customerUsername: user.username ?? null,
        contactPhone: body.contactPhone ?? null,
        ...totals,
      });
      // Cash orders have no later payment-proof step, so they're accepted right
      // here. E-Transfer orders are only accepted once the screenshot arrives
      // (via a separate message) — showing Accept here too would invite
      // confirming an order before payment is actually verified.
      const keyboard =
        body.paymentMethod === "cash"
          ? new InlineKeyboard().text("✅ Принять", `accept_order:${orderId}`).text("❌ Отменить", `cancel_order:${orderId}`)
          : new InlineKeyboard().text("❌ Отменить", `cancel_order:${orderId}`);
      botApi.sendMessage(orderGroupId, groupMessage, { reply_markup: keyboard }).catch((err) => {
        app.log.error({ err, orderId }, "Failed to send order notification to group");
      });
    }

    reply.code(201);
    return { orderId, ...totals, walletPayLink };
  });

  app.get("/api/orders", async (request, reply) => {
    const user = authenticate(request, reply, botToken);
    if (!user) return;

    const orders = listOrdersStmt.all(user.id) as any[];
    return orders.map((order) => ({
      id: order.id,
      status: order.status,
      deliveryMethod: order.delivery_method,
      paymentMethod: order.payment_method,
      totalCents: order.total_cents,
      createdAt: order.created_at,
      items: (listOrderItemsStmt.all(order.id) as any[]).map((i) => ({
        productId: i.product_id,
        flavour: i.flavour,
        qty: i.qty,
        unitPriceCents: i.unit_price_cents,
      })),
    }));
  });
}
