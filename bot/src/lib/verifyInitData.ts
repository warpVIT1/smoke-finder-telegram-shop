import { createHmac } from "node:crypto";

export interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  username?: string;
  language_code?: string;
}

export interface VerifiedInitData {
  user: TelegramWebAppUser;
  authDate: number;
}

/**
 * Validates Telegram Mini App initData server-side per Telegram's documented
 * algorithm (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
 * Returns null when the signature doesn't match or required fields are missing —
 * callers must treat that as unauthenticated, never fall back to trusting the raw payload.
 */
export function verifyInitData(initData: string, botToken: string): VerifiedInitData | null {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (computedHash !== hash) return null;

  const authDate = Number(params.get("auth_date") ?? 0);
  const userRaw = params.get("user");
  if (!userRaw) return null;

  try {
    const user = JSON.parse(userRaw) as TelegramWebAppUser;
    if (!user.id) return null;
    return { user, authDate };
  } catch {
    return null;
  }
}
