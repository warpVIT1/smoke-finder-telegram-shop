/** What a conversation (started via /api/contact-hint) is actually about —
 * drives how relayed messages are formatted. */
export type ContactContext =
  | { type: "order"; orderId: number }
  | { type: "prepay"; productId: string; productName: string; flavour: string | null }
  | { type: "general" };

/** telegramId -> context, for as long as the conversation is open. Set when
 * /api/contact-hint sends its prompt; EVERY plain-text message the customer
 * sends after that (not just the first) gets relayed while this entry
 * exists — it's only removed when either side taps "Close". */
export const openConversations = new Map<number, ContactContext>();

/** The relayed question message's id (in the manager group/DM) -> the
 * customer's telegram id — so when the admin REPLIES to that specific
 * message, the reply routes back to the right customer. Not removed after
 * one reply — the admin can reply to the same message repeatedly for as
 * long as the conversation stays open. */
export const pendingQuestionReplies = new Map<number, number>();
