import type { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { verifyInitData } from "../lib/verifyInitData.js";

export function registerMeRoutes(app: FastifyInstance, botToken: string) {
  app.get("/api/me", async (request, reply) => {
    const initData = request.headers["x-telegram-init-data"];
    const verified = verifyInitData(typeof initData === "string" ? initData : "", botToken);
    if (!verified) {
      reply.code(401);
      return { error: "unauthorized" };
    }

    db.prepare(
      `INSERT INTO users (telegram_id, first_name, username, language)
       VALUES (@id, @first_name, @username, @language)
       ON CONFLICT(telegram_id) DO UPDATE SET first_name = excluded.first_name, username = excluded.username`
    ).run({
      id: verified.user.id,
      first_name: verified.user.first_name ?? null,
      username: verified.user.username ?? null,
      language: verified.user.language_code ?? "en",
    });

    const row = db
      .prepare(`SELECT telegram_id, first_name, username, points, member_since, phone, discount_percent FROM users WHERE telegram_id = ?`)
      .get(verified.user.id) as {
      telegram_id: number;
      first_name: string | null;
      username: string | null;
      points: number;
      member_since: string;
      phone: string | null;
      discount_percent: number;
    };

    return {
      telegramId: row.telegram_id,
      firstName: row.first_name,
      username: row.username,
      points: row.points,
      memberSince: row.member_since,
      phone: row.phone,
      discountPercent: row.discount_percent,
    };
  });

  // The mini app's language switcher calls this so the bot's own chat
  // messages (order confirmations, e-Transfer prompts, etc.) match whatever
  // language the customer picked in-app, not just their Telegram client's
  // language_code snapshotted at first contact.
  app.patch("/api/me", async (request, reply) => {
    const initData = request.headers["x-telegram-init-data"];
    const verified = verifyInitData(typeof initData === "string" ? initData : "", botToken);
    if (!verified) {
      reply.code(401);
      return { error: "unauthorized" };
    }
    const { language } = request.body as { language?: string };
    if (language !== "en" && language !== "uk" && language !== "ru") {
      reply.code(400);
      return { error: "invalid_language" };
    }
    db.prepare(`UPDATE users SET language = ? WHERE telegram_id = ?`).run(language, verified.user.id);
    reply.code(204);
  });
}
