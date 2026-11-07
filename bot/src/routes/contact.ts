import type { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { verifyInitData } from "../lib/verifyInitData.js";
import { openConversations, type ContactContext } from "../lib/pendingContact.js";

interface BotApiLike {
  sendMessage(chatId: number, text: string): Promise<unknown>;
}

const getUserLanguageStmt = db.prepare<[number]>(`SELECT language FROM users WHERE telegram_id = ?`);
const getProductNameStmt = db.prepare<[string]>(`SELECT name FROM products WHERE id = ?`);

function pickLang(code?: string | null): string {
  if (code === "uk" || code === "ru") return code;
  return "en";
}

const CONTACT_HINT: Record<string, string> = {
  en: "Write your question below — we'll reply soon.",
  uk: "Напишіть своє питання нижче — ми скоро відповімо.",
  ru: "Напишите свой вопрос ниже — мы скоро ответим.",
};

const PREPAY_HINT: Record<string, string> = {
  en: "Write a message to the manager below to arrange prepayment — we'll reply soon.",
  uk: "Напишіть повідомлення менеджеру нижче, щоб домовитись про передоплату — ми скоро відповімо.",
  ru: "Напишите сообщение менеджеру ниже, чтобы договориться о предоплате — мы скоро ответим.",
};

/** The mini app's "Contact" button (and the wishlist's "message manager"
 * button) ask the bot to drop this hint into the customer's own chat with
 * it — the text shows up as a real Telegram message, not a browser
 * alert(). This opens a conversation: every plain-text message the customer
 * sends from here on (no Reply needed) gets relayed to the manager, back
 * and forth, until either side taps "Close" — nothing is auto-generated or
 * sent on the customer's behalf. */
export function registerContactRoutes(app: FastifyInstance, botToken: string, botApi: BotApiLike) {
  app.post("/api/contact-hint", async (request, reply) => {
    const initData = request.headers["x-telegram-init-data"];
    const verified = verifyInitData(typeof initData === "string" ? initData : "", botToken);
    if (!verified) {
      reply.code(401);
      return { error: "unauthorized" };
    }
    const body = request.body as { orderId?: number; prepay?: { productId: string; flavour?: string } } | undefined;
    const stored = (getUserLanguageStmt.get(verified.user.id) as { language: string | null } | undefined)?.language;
    const lang = pickLang(stored ?? verified.user.language_code);

    let context: ContactContext = { type: "general" };
    let hint = CONTACT_HINT[lang];
    if (body?.prepay?.productId) {
      const product = getProductNameStmt.get(body.prepay.productId) as { name: string } | undefined;
      if (product) {
        context = { type: "prepay", productId: body.prepay.productId, productName: product.name, flavour: body.prepay.flavour?.trim() || null };
        hint = PREPAY_HINT[lang];
      }
    } else if (body?.orderId) {
      context = { type: "order", orderId: body.orderId };
    }

    openConversations.set(verified.user.id, context);
    await botApi.sendMessage(verified.user.id, hint).catch((err) => app.log.error({ err }, "Failed to send contact hint message"));
    reply.code(204);
  });
}
