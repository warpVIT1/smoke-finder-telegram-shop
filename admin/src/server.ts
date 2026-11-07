import "dotenv/config";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { registerRoutes } from "./routes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.ADMIN_PORT ?? 4848);

if (!process.env.BOT_ORIGIN || !process.env.LOCAL_ADMIN_SECRET) {
  throw new Error("BOT_ORIGIN / LOCAL_ADMIN_SECRET is not set — copy .env.example to .env and fill it in");
}

// Raised from Fastify's 1 MiB default — product photos come in as base64 JSON,
// which inflates roughly 33% over the original file size.
const app = Fastify({ logger: true, bodyLimit: 20 * 1024 * 1024 });

await app.register(fastifyStatic, {
  root: join(__dirname, "..", "public"),
});

registerRoutes(app);

// 127.0.0.1 ONLY — this must never be reachable from anywhere but this machine.
// Never run this behind a tunnel (cloudflared/localtunnel/ngrok) or bind it to
// 0.0.0.0 — it has no login of its own and holds the LOCAL_ADMIN_SECRET that
// grants full read/write access to the shop's live data on the bot server.
app.listen({ port: PORT, host: "127.0.0.1" }).then(() => {
  console.log(`Smoke Finder local admin running at http://127.0.0.1:${PORT} (this machine only)`);
});
