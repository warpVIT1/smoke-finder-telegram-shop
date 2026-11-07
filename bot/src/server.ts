import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { existsSync, readdirSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { imagesDir } from "./db/client.js";
import { registerProductRoutes } from "./routes/products.js";
import { registerOrderRoutes } from "./routes/orders.js";
import { registerMeRoutes } from "./routes/me.js";
import { registerAddressRoutes } from "./routes/addresses.js";
import { registerAdminOrderRoutes } from "./routes/adminOrders.js";
import { registerWalletPayWebhookRoute } from "./routes/walletPayWebhook.js";
import { registerContactRoutes } from "./routes/contact.js";
import { registerWishlistRoutes } from "./routes/wishlist.js";
import { registerBotInfoRoutes } from "./routes/botInfo.js";
import { registerLocalAdminRoutes } from "./routes/localAdmin.js";
import { startBot } from "./bot.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = Number(process.env.PORT ?? 8787);
const ADMIN_TELEGRAM_ID = Number(process.env.ADMIN_TELEGRAM_ID);
const ORDER_GROUP_ID = process.env.ORDER_GROUP_ID ? Number(process.env.ORDER_GROUP_ID) : undefined;
const WALLET_PAY_API_KEY = process.env.WALLET_PAY_API_KEY;
const LOCAL_ADMIN_SECRET = process.env.LOCAL_ADMIN_SECRET;

// One-time migration: when DATA_DIR is set (production), imagesDir is a fresh
// persistent-volume folder — copy over any photos baked into the Docker image
// (committed to git) so they keep working after this DATA_DIR-for-images change.
const bakedInImagesDir = join(__dirname, "..", "public", "images");
if (bakedInImagesDir !== imagesDir && existsSync(bakedInImagesDir)) {
  for (const file of readdirSync(bakedInImagesDir)) {
    const dest = join(imagesDir, file);
    if (!existsSync(dest)) copyFileSync(join(bakedInImagesDir, file), dest);
  }
}

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN is not set — copy .env.example to .env and fill it in");
}
if (!ADMIN_TELEGRAM_ID) {
  throw new Error("ADMIN_TELEGRAM_ID is not set — copy .env.example to .env and fill it in");
}

const bot = startBot(BOT_TOKEN, process.env.WEBAPP_URL, ADMIN_TELEGRAM_ID, ORDER_GROUP_ID);

// Raised from Fastify's 1 MiB default — product photos come in as base64 JSON
// from the local admin tool's image uploads, which inflates ~33% over file size.
const app = Fastify({ logger: true, bodyLimit: 20 * 1024 * 1024 });

await app.register(cors, { origin: true });

// Wallet Pay webhook signatures are computed over the exact raw request body,
// so the JSON parser also stashes the untouched string on the request —
// re-serializing the parsed object wouldn't necessarily match byte-for-byte.
app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
  const text = typeof body === "string" ? body : body.toString("utf8");
  (req as any).rawBody = text;
  try {
    done(null, text ? JSON.parse(text) : {});
  } catch (err) {
    done(err as Error, undefined);
  }
});

// Product photos, uploaded through the local admin tool's API but served here
// since this is the process the Mini App (and Telegram) actually reach over https.
await app.register(fastifyStatic, {
  root: imagesDir,
  prefix: "/images/",
});

// The built webapp itself is served from this same process/URL — the Mini App
// then calls the API via same-origin relative paths (see webapp's VITE_API_URL),
// so there's no separate hosting/tunnel to keep alive for the frontend.
await app.register(fastifyStatic, {
  root: join(__dirname, "..", "..", "webapp", "dist"),
  prefix: "/",
  decorateReply: false,
});

registerProductRoutes(app);
registerOrderRoutes(app, BOT_TOKEN, bot.api, ORDER_GROUP_ID, WALLET_PAY_API_KEY);
registerMeRoutes(app, BOT_TOKEN);
registerAddressRoutes(app, BOT_TOKEN);
registerContactRoutes(app, BOT_TOKEN, bot.api);
registerWishlistRoutes(app, BOT_TOKEN, ADMIN_TELEGRAM_ID);
registerBotInfoRoutes(app, bot.api);
registerAdminOrderRoutes(app, BOT_TOKEN, ADMIN_TELEGRAM_ID);
if (LOCAL_ADMIN_SECRET) {
  registerLocalAdminRoutes(app, LOCAL_ADMIN_SECRET);
} else {
  console.warn("[server] LOCAL_ADMIN_SECRET not set — the local admin tool's API is disabled.");
}
if (WALLET_PAY_API_KEY) {
  registerWalletPayWebhookRoute(app, WALLET_PAY_API_KEY, bot.api, ORDER_GROUP_ID);
} else {
  console.warn("[server] WALLET_PAY_API_KEY not set — Wallet Pay checkout option and webhook are disabled.");
}

app.get("/api/health", async () => ({ ok: true }));

app.listen({ port: PORT, host: "0.0.0.0" }).then(() => {
  console.log(`Smoke Finder API listening on :${PORT}`);
});
