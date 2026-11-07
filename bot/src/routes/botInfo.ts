import type { FastifyInstance } from "fastify";

interface BotApiLike {
  getMe(): Promise<{ username?: string }>;
}

let cachedUsername: string | null = null;

/** Public — just the bot's own @username, so the mini app can build a
 * referral deep link (t.me/<username>?start=<telegramId>) without hardcoding
 * it in an env var. */
export function registerBotInfoRoutes(app: FastifyInstance, botApi: BotApiLike) {
  app.get("/api/bot-info", async (request, reply) => {
    if (!cachedUsername) {
      try {
        const me = await botApi.getMe();
        cachedUsername = me.username ?? null;
      } catch (err) {
        app.log.error({ err }, "Failed to fetch bot username");
      }
    }
    if (!cachedUsername) {
      reply.code(503);
      return { error: "unavailable" };
    }
    return { username: cachedUsername };
  });
}
