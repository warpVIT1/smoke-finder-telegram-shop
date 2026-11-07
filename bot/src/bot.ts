import { Bot, InlineKeyboard } from "grammy";
import { db } from "./db/client.js";
import {
  buildAcceptedMessage,
  buildCancelledMessage,
  buildCancelReasonMessage,
  buildReadyPickupMessage,
  buildDeliveredMessage,
} from "./lib/orderMessage.js";
import { openConversations, pendingQuestionReplies } from "./lib/pendingContact.js";

const userExistsStmt = db.prepare<[number]>(`SELECT 1 FROM users WHERE telegram_id = ?`);
const insertReferredUserStmt = db.prepare(`
  INSERT INTO users (telegram_id, first_name, username, language, referred_by)
  VALUES (@id, @first_name, @username, @language, @referred_by)
`);
const countReferralsStmt = db.prepare<[number], { c: number }>(`SELECT COUNT(*) c FROM users WHERE referred_by = ?`);
const addPointsStmt = db.prepare(`UPDATE users SET points = points + ? WHERE telegram_id = ?`);

const REFERRALS_PER_POINT = 15;

/**
 * Records who invited a brand-new user, from a `/start <telegram_id>` deep link.
 * Only counts the very first time this telegram_id is ever seen by the bot —
 * an already-registered user opening the same (or any) link again must NOT
 * increment anyone's referral count. Self-referral and unknown/invalid referrer
 * ids are ignored (referred_by stays null, still a normal new user).
 *
 * Points are for every 15th referral, not a one-time bonus at #15 — someone
 * with 14 referrals has 0 points, 15 has 1, 30 has 2, and so on, computed as
 * floor(count / 15) so it only fires exactly when that count is crossed.
 */
function recordReferralIfNewUser(telegramId: number, payload: string | undefined, first_name?: string, username?: string, language?: string) {
  if (userExistsStmt.get(telegramId)) return;

  let referredBy: number | null = null;
  const referrerId = payload ? Number(payload) : NaN;
  if (Number.isFinite(referrerId) && referrerId !== telegramId && userExistsStmt.get(referrerId)) {
    referredBy = referrerId;
  }

  insertReferredUserStmt.run({
    id: telegramId,
    first_name: first_name ?? null,
    username: username ?? null,
    language: language ?? "en",
    referred_by: referredBy,
  });

  if (referredBy != null) {
    const count = countReferralsStmt.get(referredBy)!.c;
    if (count % REFERRALS_PER_POINT === 0) {
      addPointsStmt.run(1, referredBy);
    }
  }
}

const WELCOME: Record<string, string> = {
  en: "Smoke Finder — nicotine vaping devices and e-liquids, delivered in Calgary. Tap below to browse.",
  uk: "Smoke Finder — пристрої для вейпінгу та рідини з нікотином, доставка по Калгарі. Натисніть, щоб переглянути каталог.",
  ru: "Smoke Finder — устройства для вейпинга и жидкости с никотином, доставка по Калгари. Нажмите, чтобы открыть каталог.",
};

const OPEN_LABEL: Record<string, string> = {
  en: "Open Smoke Finder",
  uk: "Відкрити Smoke Finder",
  ru: "Открыть Smoke Finder",
};

function pickLang(code?: string): string {
  if (code === "uk" || code === "ru") return code;
  return "en";
}

const getUserLanguageStmt = db.prepare<[number]>(`SELECT language FROM users WHERE telegram_id = ?`);
const getUserPhoneStmt = db.prepare<[number]>(`SELECT phone FROM users WHERE telegram_id = ?`);

/**
 * A returning user's language is whatever they last picked in the mini app's
 * switcher (persisted to users.language via PATCH /api/me), NOT their
 * Telegram client's language_code — those can disagree (e.g. Telegram set to
 * English, shop switched to Ukrainian). Only brand-new users (no row yet)
 * fall back to the Telegram client's code.
 */
function getUserLang(telegramId: number | undefined, fallbackCode?: string): string {
  const row = telegramId != null ? (getUserLanguageStmt.get(telegramId) as { language: string | null } | undefined) : undefined;
  if (row?.language) return pickLang(row.language);
  return pickLang(fallbackCode);
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const PROOF_THANKS: Record<string, string> = {
  en: "Thanks! We'll check it and confirm shortly.",
  uk: "Дякуємо! Перевіримо і скоро підтвердимо.",
  ru: "Спасибо! Проверим и скоро подтвердим.",
};

const MANAGER_REPLY_LABEL: Record<string, string> = {
  en: "Reply from the manager",
  uk: "Відповідь менеджера",
  ru: "Ответ менеджера",
};

const CONTACT_SENT_MSG: Record<string, string> = {
  en: "✅ Your message has been sent to the managers — please wait for a reply.",
  uk: "✅ Ваше повідомлення надіслано менеджерам — очікуйте на відповідь.",
  ru: "✅ Ваше сообщение отправлено менеджерам — ожидайте ответа.",
};

const CLOSE_CONV_LABEL: Record<string, string> = {
  en: "🔒 Close",
  uk: "🔒 Закрити",
  ru: "🔒 Закрыть обращение",
};

const CONV_CLOSED_BY_MANAGER_MSG: Record<string, string> = {
  en: "🔒 This conversation has been closed. Message us again any time to start a new one.",
  uk: "🔒 Це звернення закрито. Напишіть нам знову в будь-який час, щоб почати нове.",
  ru: "🔒 Это обращение закрыто. Напишите нам снова в любое время, чтобы начать новое.",
};

const PROOF_NO_ORDER: Record<string, string> = {
  en: "We don't see a pending e-Transfer order for you right now — if this is for a new order, place it first in the shop.",
  uk: "Наразі не бачимо замовлення з очікуваним e-Transfer — якщо це нове замовлення, спершу оформіть його в магазині.",
  ru: "Сейчас не видим заказ, ожидающий e-Transfer — если это новый заказ, сначала оформите его в магазине.",
};

const PAYMENT_CONFIRMED_MSG: Record<string, (orderId: string) => string> = {
  en: (orderId) => `✅ Payment for order #${orderId} confirmed — we're preparing it now.`,
  uk: (orderId) => `✅ Оплату замовлення #${orderId} підтверджено — вже готуємо.`,
  ru: (orderId) => `✅ Оплата заказа #${orderId} подтверждена — уже готовим.`,
};

const findPendingETransferOrderStmt = db.prepare<[number]>(`
  SELECT id, total_cents FROM orders
  WHERE telegram_id = ? AND payment_method = 'e_transfer' AND payment_confirmed = 0
  ORDER BY created_at DESC LIMIT 1
`);
const setPaymentProofStmt = db.prepare(`UPDATE orders SET payment_proof_file_id = ? WHERE id = ?`);
const getOrderForActionStmt = db.prepare<[number]>(`
  SELECT o.id, o.telegram_id, o.total_cents, o.status, o.delivery_method, u.language
  FROM orders o LEFT JOIN users u ON u.telegram_id = o.telegram_id
  WHERE o.id = ?
`);
const confirmPaymentStmt = db.prepare(`UPDATE orders SET payment_confirmed = 1 WHERE id = ?`);
const acceptOrderStmt = db.prepare(`UPDATE orders SET status = 'accepted' WHERE id = ?`);
const packOrderStmt = db.prepare(`UPDATE orders SET status = 'packed' WHERE id = ?`);
const readyPickupOrderStmt = db.prepare(`UPDATE orders SET status = 'ready_pickup' WHERE id = ?`);
const deliverOrderStmt = db.prepare(`UPDATE orders SET status = 'delivered' WHERE id = ?`);
const cancelOrderStmt = db.prepare(`UPDATE orders SET status = 'cancelled' WHERE id = ?`);

function nextStageKeyboard(orderId: number, deliveryMethod: "courier" | "pickup", stage: "accepted" | "packed"): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (stage === "accepted") {
    kb.text("📦 Сбор окончен", `pack_order:${orderId}`);
  } else if (deliveryMethod === "pickup") {
    kb.text("🏪 Можно забирать", `ready_pickup:${orderId}`);
  } else {
    kb.text("✅ Доставлено", `deliver_order:${orderId}`);
  }
  return kb.text("❌ Отменить", `cancel_order:${orderId}`);
}

type OrderForAction = {
  id: number;
  telegram_id: number;
  total_cents: number;
  status: string;
  delivery_method: "courier" | "pickup";
  language: string | null;
};

const ADMIN_COMMAND = "qz9panel7k";

export function startBot(botToken: string, webAppUrl?: string, adminId?: number, orderGroupId?: number) {
  const bot = new Bot(botToken);

  // Cancel-with-reason state: click Cancel → order is cancelled right away →
  // the admin can optionally REPLY (Telegram's native reply-to-message) to
  // that specific prompt with a reason → captured here and offered back with
  // a Send button before it actually reaches the customer. Keyed by the
  // prompt message's own id so it works no matter how many cancellations are
  // in flight at once, and only a genuine reply counts — not just any text.
  const pendingReasonPrompt = new Map<number, number>(); // promptMessageId -> orderId
  const pendingReasonText = new Map<number, string>(); // orderId -> captured reason text

  // Which open conversations have already sent their first message — that
  // one gets the full context card (who/order/product) and the customer's
  // "message sent" confirmation; every later message in the SAME open
  // conversation is relayed as plain text with neither, so the thread
  // doesn't repeat the same header over and over. Cleared when the
  // conversation closes, so a fresh one after that starts over.
  const conversationStarted = new Set<number>();

  function isAdmin(id: number | undefined): boolean {
    return !!adminId && id === adminId;
  }

  bot.command("start", async (ctx) => {
    const lang = getUserLang(ctx.from?.id, ctx.from?.language_code);
    if (ctx.from) {
      recordReferralIfNewUser(ctx.from.id, ctx.match, ctx.from.first_name, ctx.from.username, ctx.from.language_code);
    }
    if (webAppUrl && webAppUrl.startsWith("https://")) {
      const keyboard = new InlineKeyboard().webApp(OPEN_LABEL[lang], webAppUrl);
      await ctx.reply(WELCOME[lang], { reply_markup: keyboard });
    } else {
      await ctx.reply(
        `${WELCOME[lang]}\n\n(dev mode: WEBAPP_URL is not an https URL yet, so the in-chat button is disabled — open ${webAppUrl ?? "the webapp"} directly in a browser for now)`
      );
    }
  });

  // Hidden — deliberately never registered via setMyCommands, so it never appears
  // in Telegram's "/" suggestion list. Anyone but the admin gets total silence:
  // no reply at all, so the command's existence isn't revealed either.
  bot.command(ADMIN_COMMAND, async (ctx) => {
    if (!adminId || ctx.from?.id !== adminId) return;
    if (!webAppUrl || !webAppUrl.startsWith("https://")) {
      await ctx.reply("WEBAPP_URL isn't https yet — can't open the admin mini app.");
      return;
    }
    const keyboard = new InlineKeyboard().webApp("Admin", `${webAppUrl}?admin=1`);
    await ctx.reply("Admin panel", { reply_markup: keyboard });
  });

  // Customer sends a screenshot after an e-Transfer order → forward it to the
  // admin with a Confirm button. Only ever matched against that customer's own
  // most recent unconfirmed e-Transfer order — never trusts a client-supplied order id.
  bot.on("message:photo", async (ctx) => {
    const lang = getUserLang(ctx.from.id, ctx.from?.language_code);
    const order = findPendingETransferOrderStmt.get(ctx.from.id) as { id: number; total_cents: number } | undefined;
    if (!order) {
      await ctx.reply(PROOF_NO_ORDER[lang]);
      return;
    }
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    setPaymentProofStmt.run(photo.file_id, order.id);
    await ctx.reply(PROOF_THANKS[lang]);

    const proofTarget = orderGroupId ?? adminId;
    if (proofTarget) {
      const who = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
      const keyboard = new InlineKeyboard()
        .text("✅ Принять", `payment_accept:${order.id}`)
        .text("❌ Отменить", `cancel_order:${order.id}`);
      await bot.api
        .sendPhoto(proofTarget, photo.file_id, {
          caption: `Заказ #${order.id} · ${who} · ${formatCents(order.total_cents)}\nСкриншот e-Transfer — сверьте с почтой, затем подтвердите.`,
          reply_markup: keyboard,
        })
        .catch((err) => console.error("[bot] failed to forward payment proof:", err));
    }
  });

  // Only the admin's own click can ever act — checked again here even though
  // these buttons only ever go to the admin's own DM or the manager group.
  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;

    // "Close" on a conversation — either the admin (from the group message)
    // or the customer themselves (on their own copy of the message) can end
    // it. Checked before the blanket admin-only guard below, since this is
    // the one button a non-admin is allowed to press.
    //
    // Which side closed it is decided by WHICH CHAT the click came from —
    // the customer's own private chat vs. the manager group — not by whose
    // Telegram account clicked. If the admin is also testing as their own
    // "customer" (same account in both places), ctx.from.id is identical
    // either way, so that alone can't tell the two apart; ctx.chat.id can,
    // since one button lives in the customer's DM and the other in the group.
    if (data.startsWith("close_conv:")) {
      const telegramId = Number(data.split(":")[1]);
      const closedFromCustomerChat = ctx.chat?.id === telegramId;
      if (!closedFromCustomerChat && !isAdmin(ctx.from.id)) {
        await ctx.answerCallbackQuery({ text: "Not allowed" });
        return;
      }
      if (!openConversations.has(telegramId)) {
        await ctx.answerCallbackQuery({ text: "Уже закрыто" });
        await ctx.editMessageReplyMarkup(undefined).catch(() => {});
        return;
      }
      openConversations.delete(telegramId);
      conversationStarted.delete(telegramId);
      await ctx.answerCallbackQuery({ text: "Закрыто" });
      await ctx.editMessageReplyMarkup(undefined).catch(() => {});
      if (closedFromCustomerChat) {
        const target = orderGroupId ?? adminId;
        if (target) {
          const who = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name ?? String(telegramId);
          await bot.api.sendMessage(target, `🔒 ${who} закрыл(а) обращение.`).catch(() => {});
        }
      } else {
        const lang = getUserLang(telegramId);
        await bot.api.sendMessage(telegramId, CONV_CLOSED_BY_MANAGER_MSG[lang]).catch(() => {});
      }
      return;
    }

    if (!isAdmin(ctx.from.id)) {
      await ctx.answerCallbackQuery({ text: "Not allowed" });
      return;
    }

    if (data.startsWith("payment_accept:")) {
      const orderId = Number(data.split(":")[1]);
      const order = getOrderForActionStmt.get(orderId) as OrderForAction | undefined;
      if (!order) {
        await ctx.answerCallbackQuery({ text: "Order not found" });
        return;
      }
      confirmPaymentStmt.run(orderId);
      acceptOrderStmt.run(orderId);
      await ctx.answerCallbackQuery({ text: "Confirmed" });
      await ctx
        .editMessageReplyMarkup({ reply_markup: nextStageKeyboard(order.id, order.delivery_method, "accepted") })
        .catch(() => {});
      const lang = pickLang(order.language ?? undefined);
      await bot.api
        .sendMessage(order.telegram_id, PAYMENT_CONFIRMED_MSG[lang](String(order.id)))
        .catch((err) => console.error("[bot] failed to notify customer of payment confirmation:", err));
      await bot.api
        .sendMessage(order.telegram_id, buildAcceptedMessage(lang, order.id, order.delivery_method))
        .catch((err) => console.error("[bot] failed to notify customer of order acceptance:", err));
      return;
    }

    if (data.startsWith("accept_order:")) {
      const orderId = Number(data.split(":")[1]);
      const order = getOrderForActionStmt.get(orderId) as OrderForAction | undefined;
      if (!order) {
        await ctx.answerCallbackQuery({ text: "Order not found" });
        return;
      }
      if (order.status === "cancelled") {
        await ctx.answerCallbackQuery({ text: "Заказ уже отменён" });
        return;
      }
      acceptOrderStmt.run(orderId);
      await ctx.answerCallbackQuery({ text: "Принято" });
      await ctx
        .editMessageReplyMarkup({ reply_markup: nextStageKeyboard(order.id, order.delivery_method, "accepted") })
        .catch(() => {});
      const lang = pickLang(order.language ?? undefined);
      await bot.api
        .sendMessage(order.telegram_id, buildAcceptedMessage(lang, order.id, order.delivery_method))
        .catch((err) => console.error("[bot] failed to notify customer of order acceptance:", err));
      return;
    }

    if (data.startsWith("pack_order:")) {
      const orderId = Number(data.split(":")[1]);
      const order = getOrderForActionStmt.get(orderId) as OrderForAction | undefined;
      if (!order) {
        await ctx.answerCallbackQuery({ text: "Order not found" });
        return;
      }
      if (order.status === "cancelled") {
        await ctx.answerCallbackQuery({ text: "Заказ уже отменён" });
        return;
      }
      packOrderStmt.run(orderId);
      await ctx.answerCallbackQuery({ text: "Сбор окончен" });
      await ctx
        .editMessageReplyMarkup({ reply_markup: nextStageKeyboard(order.id, order.delivery_method, "packed") })
        .catch(() => {});
      return;
    }

    if (data.startsWith("ready_pickup:")) {
      const orderId = Number(data.split(":")[1]);
      const order = getOrderForActionStmt.get(orderId) as OrderForAction | undefined;
      if (!order) {
        await ctx.answerCallbackQuery({ text: "Order not found" });
        return;
      }
      if (order.status === "cancelled") {
        await ctx.answerCallbackQuery({ text: "Заказ уже отменён" });
        return;
      }
      readyPickupOrderStmt.run(orderId);
      await ctx.answerCallbackQuery({ text: "Готово к выдаче" });
      await ctx
        .editMessageReplyMarkup({ reply_markup: new InlineKeyboard().text("✅ Отдано", `deliver_order:${order.id}`).text("❌ Отменить", `cancel_order:${order.id}`) })
        .catch(() => {});
      const lang = pickLang(order.language ?? undefined);
      await bot.api
        .sendMessage(order.telegram_id, buildReadyPickupMessage(lang, order.id))
        .catch((err) => console.error("[bot] failed to notify customer order is ready for pickup:", err));
      return;
    }

    if (data.startsWith("deliver_order:")) {
      const orderId = Number(data.split(":")[1]);
      const order = getOrderForActionStmt.get(orderId) as OrderForAction | undefined;
      if (!order) {
        await ctx.answerCallbackQuery({ text: "Order not found" });
        return;
      }
      if (order.status === "cancelled") {
        await ctx.answerCallbackQuery({ text: "Заказ уже отменён" });
        return;
      }
      deliverOrderStmt.run(orderId);
      await ctx.answerCallbackQuery({ text: "Завершено" });
      await ctx.editMessageReplyMarkup(undefined).catch(() => {});
      const lang = pickLang(order.language ?? undefined);
      await bot.api
        .sendMessage(order.telegram_id, buildDeliveredMessage(lang, order.id, order.delivery_method))
        .catch((err) => console.error("[bot] failed to notify customer of delivery:", err));
      return;
    }

    if (data.startsWith("cancel_order:")) {
      const orderId = Number(data.split(":")[1]);
      const order = getOrderForActionStmt.get(orderId) as OrderForAction | undefined;
      if (!order) {
        await ctx.answerCallbackQuery({ text: "Order not found" });
        return;
      }
      if (order.status === "cancelled") {
        await ctx.answerCallbackQuery({ text: "Уже отменён" });
        return;
      }
      cancelOrderStmt.run(orderId);
      await ctx.answerCallbackQuery({ text: "Отменено" });
      await ctx.editMessageReplyMarkup(undefined).catch(() => {});
      const lang = pickLang(order.language ?? undefined);
      await bot.api
        .sendMessage(order.telegram_id, buildCancelledMessage(lang, order.id))
        .catch((err) => console.error("[bot] failed to notify customer of cancellation:", err));

      const prompt = await ctx.reply(
        `Заказ #${orderId} отменён, клиенту отправлено уведомление. Если хотите указать причину — ОТВЕТЬТЕ на это сообщение текстом причины.`
      );
      pendingReasonPrompt.set(prompt.message_id, orderId);
      return;
    }

    if (data.startsWith("send_reason:")) {
      const orderId = Number(data.split(":")[1]);
      const reason = pendingReasonText.get(orderId);
      if (!reason) {
        await ctx.answerCallbackQuery({ text: "Текст причины не найден" });
        return;
      }
      const order = getOrderForActionStmt.get(orderId) as OrderForAction | undefined;
      if (!order) {
        await ctx.answerCallbackQuery({ text: "Order not found" });
        return;
      }
      const lang = pickLang(order.language ?? undefined);
      await bot.api
        .sendMessage(order.telegram_id, buildCancelReasonMessage(lang, order.id, reason))
        .catch((err) => console.error("[bot] failed to send cancellation reason:", err));
      pendingReasonText.delete(orderId);
      await ctx.answerCallbackQuery({ text: "Отправлено" });
      await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    }
  });

  bot.on("message:text", async (ctx) => {
    const replyToId = ctx.message.reply_to_message?.message_id;

    // Admin genuinely REPLYING to a cancellation prompt — captures the reason
    // to offer back with a Send button, same as before.
    if (isAdmin(ctx.from?.id) && replyToId != null && pendingReasonPrompt.has(replyToId)) {
      const orderId = pendingReasonPrompt.get(replyToId)!;
      pendingReasonPrompt.delete(replyToId);
      const reason = ctx.message.text.trim();
      if (!reason) return;
      pendingReasonText.set(orderId, reason);
      const keyboard = new InlineKeyboard().text("📤 Отправить", `send_reason:${orderId}`);
      await ctx.reply(`Причина отмены заказа #${orderId}: «${reason}» — отправить клиенту?`, { reply_markup: keyboard });
      return;
    }

    // The admin REPLYING to a relayed question — routed straight back to
    // whichever customer originally asked it. Not consumed after one reply —
    // the admin can keep replying to the same message for as long as the
    // conversation stays open. Checked BEFORE the generic customer-message
    // branch below: if the admin is also testing as their own "customer"
    // (same Telegram account), a genuine Reply from them must still be
    // treated as a manager reply, not swallowed as a new customer message.
    if (isAdmin(ctx.from?.id) && replyToId != null && pendingQuestionReplies.has(replyToId)) {
      const customerTelegramId = pendingQuestionReplies.get(replyToId)!;
      const answer = ctx.message.text.trim();
      if (!answer) return;
      if (!openConversations.has(customerTelegramId)) {
        await ctx.reply("Обращение уже закрыто клиентом.").catch(() => {});
        return;
      }
      const lang = getUserLang(customerTelegramId);
      await bot.api
        .sendMessage(customerTelegramId, `💬 ${MANAGER_REPLY_LABEL[lang]}:\n${answer}`, {
          reply_markup: new InlineKeyboard().text(CLOSE_CONV_LABEL[lang], `close_conv:${customerTelegramId}`),
        })
        .catch((err) => console.error("[bot] failed to relay manager reply to customer:", err));
      await ctx.reply("Отправлено клиенту ✅").catch(() => {});
      return;
    }

    // A customer's plain-text message while a conversation is open (started
    // via /api/contact-hint) — no Reply required, just whatever they type —
    // relayed to the manager group (or DM if no group configured). The
    // conversation STAYS open (not just their first message) so they can
    // send several messages back and forth, until either side taps "Close".
    // Only the FIRST message gets the full context card (who/order/product)
    // and the customer's "message sent" confirmation — later messages in the
    // same open conversation are relayed as plain text with neither, so the
    // thread doesn't repeat the same header over and over.
    if (ctx.from && openConversations.has(ctx.from.id)) {
      const context = openConversations.get(ctx.from.id)!;
      const question = ctx.message.text.trim();
      if (!question) return;
      const isFirstMessage = !conversationStarted.has(ctx.from.id);
      conversationStarted.add(ctx.from.id);

      const target = orderGroupId ?? adminId;
      if (target) {
        try {
          let sent;
          if (isFirstMessage) {
            const phone = (getUserPhoneStmt.get(ctx.from.id) as { phone: string | null } | undefined)?.phone;
            const lines =
              context.type === "prepay" ? ["💰 Запрос на предоплату (пожизненная скидка 5%)"] : ["❓ Вопрос"];
            if (context.type === "order") lines.push(`Заказ: #${context.orderId}`);
            if (context.type === "prepay") {
              lines.push(`Товар: ${context.productName}${context.flavour ? ` (${context.flavour})` : ""}`);
            }
            lines.push(`Пользователь: ${ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name ?? "—"}`);
            if (phone) lines.push(`Телефон: ${phone}`);
            lines.push("", question, "", "↩️ Ответьте на это сообщение, чтобы клиент получил ваш ответ.");
            const closeKeyboard = new InlineKeyboard().text(CLOSE_CONV_LABEL.ru, `close_conv:${ctx.from.id}`);
            sent = await bot.api.sendMessage(target, lines.join("\n"), { reply_markup: closeKeyboard });
          } else {
            // Still tagged with who it's from — if several customers have open
            // conversations at once, a bare line of text is impossible to tell apart.
            const who = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name ?? String(ctx.from.id);
            sent = await bot.api.sendMessage(target, `${who}: ${question}`);
          }
          pendingQuestionReplies.set(sent.message_id, ctx.from.id);
        } catch (err) {
          console.error("[bot] failed to relay customer question:", err);
        }
      }
      if (isFirstMessage) {
        const lang = getUserLang(ctx.from.id, ctx.from.language_code);
        await ctx
          .reply(CONTACT_SENT_MSG[lang], { reply_markup: new InlineKeyboard().text(CLOSE_CONV_LABEL[lang], `close_conv:${ctx.from.id}`) })
          .catch(() => {});
      }
      return;
    }
  });

  if (webAppUrl && webAppUrl.startsWith("https://")) {
    bot.api
      .setChatMenuButton({
        menu_button: { type: "web_app", text: "Smoke Finder", web_app: { url: webAppUrl } },
      })
      .catch((err) => console.error("Failed to set chat menu button:", err));
  } else {
    console.warn(
      "[bot] WEBAPP_URL is missing or not https — skipping setChatMenuButton. Set an https tunnel URL in .env to enable the in-Telegram menu button."
    );
  }

  bot.catch((err) => console.error("[bot] error:", err));

  bot.start();
  console.log("Smoke Finder bot started (long polling)");
  return bot;
}
