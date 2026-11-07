import type { FastifyInstance, FastifyRequest } from "fastify";
import { db } from "../db/client.js";
import { verifyWalletPayWebhookSignature, type WalletPayWebhookEvent } from "../lib/walletPay.js";
import { buildAcceptedMessage } from "../lib/orderMessage.js";

const WEBHOOK_PATH = "/api/wallet-pay/webhook";

interface BotApiLike {
  sendMessage(chatId: number, text: string): Promise<unknown>;
}

const getOrderByWalletPayIdStmt = db.prepare<[string]>(`
  SELECT o.id, o.telegram_id, o.status, o.delivery_method, o.payment_confirmed, u.language
  FROM orders o LEFT JOIN users u ON u.telegram_id = o.telegram_id
  WHERE o.wallet_pay_order_id = ?
`);
const confirmWalletPayOrderStmt = db.prepare(`UPDATE orders SET payment_confirmed = 1, status = 'accepted' WHERE id = ?`);

function pickLang(code?: string | null): string {
  if (code === "uk" || code === "ru") return code;
  return "en";
}

export function registerWalletPayWebhookRoute(app: FastifyInstance, apiKey: string, botApi: BotApiLike, orderGroupId?: number) {
  app.post(WEBHOOK_PATH, async (request: FastifyRequest, reply) => {
    const timestamp = request.headers["walletpay-timestamp"];
    const signature = request.headers["walletpay-signature"];
    const rawBody = (request as any).rawBody as string | undefined;

    if (typeof timestamp !== "string" || typeof signature !== "string" || rawBody == null) {
      reply.code(401);
      return { error: "missing_signature" };
    }
    const valid = verifyWalletPayWebhookSignature(apiKey, "POST", WEBHOOK_PATH, timestamp, rawBody, signature);
    if (!valid) {
      app.log.warn("Wallet Pay webhook: signature mismatch");
      reply.code(401);
      return { error: "invalid_signature" };
    }

    const events = request.body as WalletPayWebhookEvent[];
    for (const event of events) {
      if (event.type !== "ORDER_PAID") continue;
      const walletPayOrderId = String(event.payload.orderId ?? "");
      if (!walletPayOrderId) continue;

      const order = getOrderByWalletPayIdStmt.get(walletPayOrderId) as
        | {
            id: number;
            telegram_id: number;
            status: string;
            delivery_method: "courier" | "pickup";
            payment_confirmed: number;
            language: string | null;
          }
        | undefined;
      if (!order || order.payment_confirmed) continue; // unknown order, or already processed (webhook can repeat)

      confirmWalletPayOrderStmt.run(order.id);
      const lang = pickLang(order.language);
      await botApi
        .sendMessage(order.telegram_id, buildAcceptedMessage(lang, order.id, order.delivery_method))
        .catch((err) => app.log.error({ err, orderId: order.id }, "Failed to notify customer of Wallet Pay confirmation"));

      if (orderGroupId) {
        await botApi
          .sendMessage(orderGroupId, `💰 Оплата через Wallet Pay получена — заказ #${order.id} принят автоматически.`)
          .catch((err) => app.log.error({ err, orderId: order.id }, "Failed to notify group of Wallet Pay confirmation"));
      }
    }

    reply.code(200);
    return { ok: true };
  });
}
