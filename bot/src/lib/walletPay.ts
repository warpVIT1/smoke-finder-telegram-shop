import { createHmac } from "node:crypto";

const BASE_URL = "https://pay.wallet.tg/wpay/store-api/v1";

export interface CreateWalletPayOrderInput {
  amountUsd: number;
  description: string;
  externalId: string;
  customerTelegramUserId: number;
  timeoutSeconds: number;
  returnUrl?: string;
  failReturnUrl?: string;
  customData?: string;
}

export interface WalletPayOrder {
  id: number;
  status: string;
  number: string;
  payLink: string;
  directPayLink: string;
  createdDateTime: string;
  expirationDateTime: string;
  completedDateTime?: string;
}

interface WalletPayResponse<T> {
  status: "SUCCESS" | "ERROR";
  message: string;
  data: T;
}

async function walletPayFetch<T>(apiKey: string, method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Wpay-Store-Api-Key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as WalletPayResponse<T>;
  if (!res.ok || json.status !== "SUCCESS") {
    throw new Error(`Wallet Pay API error (${res.status}): ${json.message || "unknown"}`);
  }
  return json.data;
}

/** Always converts to USDT so the store isn't exposed to crypto price swings,
 * regardless of what coin the customer actually pays with. */
export function createWalletPayOrder(apiKey: string, input: CreateWalletPayOrderInput): Promise<WalletPayOrder> {
  return walletPayFetch<WalletPayOrder>(apiKey, "POST", "/order", {
    amount: { amount: input.amountUsd.toFixed(2), currencyCode: "USD" },
    autoConversionCurrency: "USDT",
    description: input.description,
    returnUrl: input.returnUrl,
    failReturnUrl: input.failReturnUrl,
    customData: input.customData,
    externalId: input.externalId,
    timeoutSeconds: input.timeoutSeconds,
    customerTelegramUserId: input.customerTelegramUserId,
  });
}

export function getWalletPayOrder(apiKey: string, orderId: string): Promise<WalletPayOrder> {
  return walletPayFetch<WalletPayOrder>(apiKey, "GET", `/order?id=${encodeURIComponent(orderId)}`);
}

/**
 * Per docs.wallet.tg/pay: signature = Base64(HmacSHA256(
 *   "HTTP-method.URI-path.timestamp.Base64-encoded-body", secret=Wpay-Store-Api-Key
 * )). URI-path must match exactly what's configured in the Store settings
 * (with or without a trailing slash), so callers pass the raw request path through.
 */
export function verifyWalletPayWebhookSignature(
  apiKey: string,
  method: string,
  uriPath: string,
  timestamp: string,
  rawBody: string,
  signature: string
): boolean {
  const base64Body = Buffer.from(rawBody, "utf8").toString("base64");
  const payload = `${method}.${uriPath}.${timestamp}.${base64Body}`;
  const expected = createHmac("sha256", apiKey).update(payload).digest("base64");
  return expected === signature;
}

export interface WalletPayWebhookEvent {
  eventDateTime: string;
  eventId: number;
  type: "ORDER_FAILED" | "ORDER_PAID";
  payload: { orderId?: number; externalId?: string; [key: string]: unknown };
}
