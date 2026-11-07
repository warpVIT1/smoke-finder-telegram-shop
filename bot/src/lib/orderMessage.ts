export interface OrderMessageItem {
  name: string;
  flavour: string | null;
  qty: number;
  unitPriceCents: number;
}

export interface OrderMessageInput {
  orderId: number | bigint;
  items: OrderMessageItem[];
  deliveryMethod: "courier" | "pickup";
  paymentMethod: "e_transfer" | "cash" | "wallet_pay" | "points";
  address?: string | null;
  walletPayLink?: string;
  subtotalCents: number;
  discountCents?: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
}

const T = {
  en: {
    title: (id: string) => `✅ Order #${id} placed!`,
    delivery: "Delivery",
    courier: "Local courier today (4:30–8:30 PM · within Calgary)",
    pickup: "Pickup — Calgary, Westbrook Station, 4:30–10 PM today",
    payment: "Payment",
    eTransfer: "Interac e-Transfer",
    cash: "Cash on delivery",
    walletPay: "Wallet Pay (crypto)",
    points: "Paid with loyalty points",
    subtotal: "Subtotal",
    discount: "Discount",
    shipping: "Delivery fee",
    tax: "GST 5%",
    total: "Total",
    address: "Address",
    eTransferInstructions: (total: string) =>
      `\nSend ${total} via Interac e-Transfer to payments@example.com, then reply here with a screenshot of the confirmation — we'll verify and confirm your order once we see it.`,
  },
  uk: {
    title: (id: string) => `✅ Замовлення #${id} оформлено!`,
    delivery: "Доставка",
    courier: "Кур'єр сьогодні (16:30–20:30 · у межах Калгарі)",
    pickup: "Самовивіз — Calgary, Westbrook Station, сьогодні 16:30–22:00",
    payment: "Оплата",
    eTransfer: "Interac e-Transfer",
    cash: "Готівка при отриманні",
    walletPay: "Wallet Pay (крипто)",
    points: "Оплачено бонусними балами",
    subtotal: "Товари",
    discount: "Знижка",
    shipping: "Доставка",
    tax: "GST 5%",
    total: "Разом",
    address: "Адреса",
    eTransferInstructions: (total: string) =>
      `\nПереведіть ${total} через Interac e-Transfer на payments@example.com, потім надішліть сюди скріншот підтвердження — ми перевіримо і підтвердимо замовлення.`,
  },
  ru: {
    title: (id: string) => `✅ Заказ #${id} оформлен!`,
    delivery: "Доставка",
    courier: "Курьер сегодня (16:30–20:30 · по Калгари)",
    pickup: "Самовывоз — Calgary, Westbrook Station, сегодня 16:30–22:00",
    payment: "Оплата",
    eTransfer: "Interac e-Transfer",
    cash: "Наличные при получении",
    walletPay: "Wallet Pay (крипто)",
    points: "Оплачено бонусными баллами",
    subtotal: "Товары",
    discount: "Скидка",
    shipping: "Доставка",
    tax: "GST 5%",
    total: "Итого",
    address: "Адрес",
    eTransferInstructions: (total: string) =>
      `\nПереведите ${total} через Interac e-Transfer на payments@example.com, затем пришлите сюда скриншот подтверждения — мы проверим и подтвердим заказ.`,
  },
} as const;

const LANG_NAME: Record<string, string> = {
  en: "English",
  uk: "Українська",
  ru: "Русский",
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function paymentLabel(t: (typeof T)[keyof typeof T], method: OrderMessageInput["paymentMethod"]): string {
  if (method === "e_transfer") return t.eTransfer;
  if (method === "wallet_pay") return t.walletPay;
  if (method === "points") return t.points;
  return t.cash;
}

/** Calgary's current hour:minute, independent of the server's own timezone. */
function getCalgaryTime(): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Edmonton",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { hour, minute };
}

/** True once it's within `bufferMinutes` of the cutoff (or past it) — used to
 * decide whether an order placed late should be pushed to tomorrow. */
function isNearCutoff(cutoffHour: number, cutoffMinute: number, bufferMinutes: number): boolean {
  const { hour, minute } = getCalgaryTime();
  const nowMin = hour * 60 + minute;
  const cutoffMin = cutoffHour * 60 + cutoffMinute;
  return nowMin >= cutoffMin - bufferMinutes;
}

const COURIER_CUTOFF = { hour: 20, minute: 30 };
const PICKUP_CUTOFF = { hour: 22, minute: 0 };
const ADMIN_HANDLE = "@warpVIT";

const ACCEPTED_T = {
  en: {
    courierToday: (id: string) => `✅ Order #${id} accepted — we're preparing it. Courier will arrive today between 4:30 and 8:30 PM.`,
    courierTomorrow: (id: string) =>
      `✅ Order #${id} accepted — we're preparing it. Too late for today's courier run, so it'll arrive tomorrow between 4:30 and 8:30 PM.`,
    pickupToday: (id: string) =>
      `✅ Order #${id} accepted. Pickup: Calgary, Westbrook Station, today between 4:30 and 10 PM. When you're on your way, message me: ${ADMIN_HANDLE}.`,
    pickupTomorrow: (id: string) =>
      `✅ Order #${id} accepted. Too late for pickup today, so it'll be ready tomorrow: Calgary, Westbrook Station, between 4:30 and 10 PM. When you're on your way, message me: ${ADMIN_HANDLE}.`,
    readyPickup: (id: string) =>
      `🏪 Order #${id} is ready — come pick it up now: Calgary, Westbrook Station. Message me when you're on your way: ${ADMIN_HANDLE}.`,
    deliveredCourier: (id: string) => `✅ Order #${id} delivered. Thanks for shopping with Smoke Finder!`,
    deliveredPickup: (id: string) => `✅ Order #${id} handed over. Thanks for shopping with Smoke Finder!`,
    cancelled: (id: string) => `❌ Order #${id} has been cancelled.`,
    cancelReason: (id: string, reason: string) => `Reason order #${id} was cancelled: ${reason}`,
  },
  uk: {
    courierToday: (id: string) => `✅ Замовлення #${id} прийнято — вже готуємо. Кур'єр приїде сьогодні з 16:30 до 20:30.`,
    courierTomorrow: (id: string) =>
      `✅ Замовлення #${id} прийнято — вже готуємо. На сьогоднішню доставку кур'єром вже запізно, привеземо завтра з 16:30 до 20:30.`,
    pickupToday: (id: string) =>
      `✅ Замовлення #${id} прийнято. Самовивіз: Calgary, Westbrook Station, сьогодні з 16:30 до 22:00. Коли будете під'їжджати — напишіть мені: ${ADMIN_HANDLE}.`,
    pickupTomorrow: (id: string) =>
      `✅ Замовлення #${id} прийнято. На сьогодні вже запізно, буде готово завтра: Calgary, Westbrook Station, з 16:30 до 22:00. Коли будете під'їжджати — напишіть мені: ${ADMIN_HANDLE}.`,
    readyPickup: (id: string) =>
      `🏪 Замовлення #${id} готове — можна забирати: Calgary, Westbrook Station. Напишіть мені, коли будете під'їжджати: ${ADMIN_HANDLE}.`,
    deliveredCourier: (id: string) => `✅ Замовлення #${id} доставлено. Дякуємо за покупку в Smoke Finder!`,
    deliveredPickup: (id: string) => `✅ Замовлення #${id} видано. Дякуємо за покупку в Smoke Finder!`,
    cancelled: (id: string) => `❌ Замовлення #${id} скасовано.`,
    cancelReason: (id: string, reason: string) => `Причина скасування замовлення #${id}: ${reason}`,
  },
  ru: {
    courierToday: (id: string) => `✅ Заказ #${id} принят в обработку — уже готовим. Курьер приедет сегодня с 16:30 до 20:30.`,
    courierTomorrow: (id: string) =>
      `✅ Заказ #${id} принят в обработку — уже готовим. На сегодняшнюю доставку курьером уже поздно, привезём завтра с 16:30 до 20:30.`,
    pickupToday: (id: string) =>
      `✅ Заказ #${id} принят. Самовывоз: Calgary, Westbrook Station, сегодня с 16:30 до 22:00. Когда будете подъезжать — напишите мне: ${ADMIN_HANDLE}.`,
    pickupTomorrow: (id: string) =>
      `✅ Заказ #${id} принят. На сегодня уже поздно, будет готово завтра: Calgary, Westbrook Station, с 16:30 до 22:00. Когда будете подъезжать — напишите мне: ${ADMIN_HANDLE}.`,
    readyPickup: (id: string) =>
      `🏪 Заказ #${id} готов — можно забирать: Calgary, Westbrook Station. Напишите мне, когда будете подъезжать: ${ADMIN_HANDLE}.`,
    deliveredCourier: (id: string) => `✅ Заказ #${id} доставлен. Спасибо за покупку в Smoke Finder!`,
    deliveredPickup: (id: string) => `✅ Заказ #${id} отдан. Спасибо за покупку в Smoke Finder!`,
    cancelled: (id: string) => `❌ Заказ #${id} отменён.`,
    cancelReason: (id: string, reason: string) => `Причина отмены заказа #${id}: ${reason}`,
  },
} as const;

/** The "accepted" message sent to the customer once the admin clicks Принять
 * on the order — branches on delivery method and how close to closing it is. */
export function buildAcceptedMessage(lang: string, orderId: number | bigint, deliveryMethod: "courier" | "pickup"): string {
  const t = ACCEPTED_T[lang as keyof typeof ACCEPTED_T] ?? ACCEPTED_T.en;
  const id = String(orderId);
  if (deliveryMethod === "courier") {
    return isNearCutoff(COURIER_CUTOFF.hour, COURIER_CUTOFF.minute, 60) ? t.courierTomorrow(id) : t.courierToday(id);
  }
  return isNearCutoff(PICKUP_CUTOFF.hour, PICKUP_CUTOFF.minute, 60) ? t.pickupTomorrow(id) : t.pickupToday(id);
}

export function buildReadyPickupMessage(lang: string, orderId: number | bigint): string {
  const t = ACCEPTED_T[lang as keyof typeof ACCEPTED_T] ?? ACCEPTED_T.en;
  return t.readyPickup(String(orderId));
}

export function buildDeliveredMessage(lang: string, orderId: number | bigint, deliveryMethod: "courier" | "pickup"): string {
  const t = ACCEPTED_T[lang as keyof typeof ACCEPTED_T] ?? ACCEPTED_T.en;
  return deliveryMethod === "courier" ? t.deliveredCourier(String(orderId)) : t.deliveredPickup(String(orderId));
}

export function buildCancelledMessage(lang: string, orderId: number | bigint): string {
  const t = ACCEPTED_T[lang as keyof typeof ACCEPTED_T] ?? ACCEPTED_T.en;
  return t.cancelled(String(orderId));
}

export function buildCancelReasonMessage(lang: string, orderId: number | bigint, reason: string): string {
  const t = ACCEPTED_T[lang as keyof typeof ACCEPTED_T] ?? ACCEPTED_T.en;
  return t.cancelReason(String(orderId), reason);
}

export function buildOrderMessage(lang: string, input: OrderMessageInput): string {
  const t = T[lang as keyof typeof T] ?? T.en;
  const lines: string[] = [t.title(String(input.orderId)), ""];

  for (const item of input.items) {
    const flavourPart = item.flavour ? ` (${item.flavour})` : "";
    lines.push(`${item.name}${flavourPart} ×${item.qty} — ${formatCents(item.unitPriceCents * item.qty)}`);
  }

  lines.push("");
  lines.push(`${t.delivery}: ${input.deliveryMethod === "courier" ? t.courier : t.pickup}`);
  if (input.deliveryMethod === "courier" && input.address) {
    lines.push(`${t.address}: ${input.address}`);
  }
  lines.push(`${t.payment}: ${paymentLabel(t, input.paymentMethod)}`);
  lines.push("");
  lines.push(`${t.subtotal}: ${formatCents(input.subtotalCents)}`);
  if (input.discountCents) lines.push(`${t.discount}: -${formatCents(input.discountCents)}`);
  lines.push(`${t.shipping}: ${formatCents(input.shippingCents)}`);
  lines.push(`${t.tax}: ${formatCents(input.taxCents)}`);
  lines.push(`${t.total}: ${formatCents(input.totalCents)}`);
  if (input.paymentMethod === "e_transfer") {
    lines.push(t.eTransferInstructions(formatCents(input.totalCents)));
  }

  return lines.join("\n");
}

export interface GroupOrderMessageInput extends OrderMessageInput {
  customerLang: string;
  customerName: string | null;
  customerUsername: string | null;
  contactPhone: string | null;
}

/** Always Russian regardless of the customer's own language — that one's
 * noted as a separate line so staff know what language to reply in. */
export function buildGroupOrderMessage(input: GroupOrderMessageInput): string {
  const t = T.ru;
  const who = input.customerUsername ? `@${input.customerUsername}` : input.customerName ?? "—";
  const lines: string[] = [t.title(String(input.orderId)), ""];

  lines.push(`Клиент: ${who}`);
  if (input.contactPhone) lines.push(`Телефон: ${input.contactPhone}`);
  lines.push(`Язык клиента: ${LANG_NAME[input.customerLang] ?? input.customerLang}`);
  lines.push("");

  for (const item of input.items) {
    const flavourPart = item.flavour ? ` (${item.flavour})` : "";
    lines.push(`${item.name}${flavourPart} ×${item.qty} — ${formatCents(item.unitPriceCents * item.qty)}`);
  }

  lines.push("");
  lines.push(`${t.delivery}: ${input.deliveryMethod === "courier" ? t.courier : t.pickup}`);
  if (input.deliveryMethod === "courier" && input.address) {
    lines.push(`${t.address}: ${input.address}`);
  }
  lines.push(`${t.payment}: ${paymentLabel(t, input.paymentMethod)}`);
  lines.push("");
  lines.push(`${t.subtotal}: ${formatCents(input.subtotalCents)}`);
  if (input.discountCents) lines.push(`${t.discount}: -${formatCents(input.discountCents)}`);
  lines.push(`${t.shipping}: ${formatCents(input.shippingCents)}`);
  lines.push(`${t.tax}: ${formatCents(input.taxCents)}`);
  lines.push(`${t.total}: ${formatCents(input.totalCents)}`);

  return lines.join("\n");
}
