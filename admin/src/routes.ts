import type { FastifyInstance } from "fastify";

/**
 * This tool no longer touches a database file directly — the bot now runs on
 * a remote server, so a local SQLite file was never the live data. Every
 * route here is a thin proxy to the bot's own /api/local-admin/* API,
 * authenticated with a shared secret (never Telegram initData, since this is
 * a plain server-to-server call with no Telegram user context).
 */

const BOT_ORIGIN = process.env.BOT_ORIGIN;
const LOCAL_ADMIN_SECRET = process.env.LOCAL_ADMIN_SECRET;

async function proxy(path: string, init?: RequestInit) {
  if (!BOT_ORIGIN || !LOCAL_ADMIN_SECRET) {
    throw new Error("BOT_ORIGIN / LOCAL_ADMIN_SECRET is not set — copy .env.example to .env and fill it in");
  }
  const res = await fetch(`${BOT_ORIGIN}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Secret": LOCAL_ADMIN_SECRET,
      ...init?.headers,
    },
  });
  return res;
}

async function forward(reply: import("fastify").FastifyReply, path: string, init?: RequestInit) {
  const res = await proxy(path, init);
  reply.code(res.status);
  if (res.status === 204) return;
  const body = await res.json().catch(() => null);
  return body;
}

export function registerRoutes(app: FastifyInstance) {
  // products
  app.get("/api/products", async (_request, reply) => forward(reply, "/api/local-admin/products"));

  app.post("/api/products", async (request, reply) =>
    forward(reply, "/api/local-admin/products", { method: "POST", body: JSON.stringify(request.body) })
  );

  app.delete("/api/products/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    return forward(reply, `/api/local-admin/products/${id}`, { method: "DELETE" });
  });

  app.post("/api/products/:id/restore", async (request, reply) => {
    const { id } = request.params as { id: string };
    return forward(reply, `/api/local-admin/products/${id}/restore`, { method: "POST" });
  });

  app.patch("/api/products/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    return forward(reply, `/api/local-admin/products/${id}`, { method: "PATCH", body: JSON.stringify(request.body) });
  });

  app.get("/api/products/:id/variants", async (request, reply) => {
    const { id } = request.params as { id: string };
    return forward(reply, `/api/local-admin/products/${id}/variants`);
  });

  app.put("/api/products/:id/variants", async (request, reply) => {
    const { id } = request.params as { id: string };
    return forward(reply, `/api/local-admin/products/${id}/variants`, {
      method: "PUT",
      body: JSON.stringify(request.body),
    });
  });

  // orders
  app.get("/api/orders", async (_request, reply) => forward(reply, "/api/local-admin/orders"));

  app.patch("/api/orders/:id/status", async (request, reply) => {
    const { id } = request.params as { id: string };
    return forward(reply, `/api/local-admin/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(request.body),
    });
  });

  // users
  app.get("/api/users", async (_request, reply) => forward(reply, "/api/local-admin/users"));

  app.post("/api/users/:id/redeem-reward", async (request, reply) => {
    const { id } = request.params as { id: string };
    return forward(reply, `/api/local-admin/users/${id}/redeem-reward`, { method: "POST" });
  });

  app.patch("/api/users/:id/discount", async (request, reply) => {
    const { id } = request.params as { id: string };
    return forward(reply, `/api/local-admin/users/${id}/discount`, { method: "PATCH", body: JSON.stringify(request.body) });
  });

  // wishlist
  app.get("/api/wishlist", async (_request, reply) => forward(reply, "/api/local-admin/wishlist"));

  app.patch("/api/wishlist/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    return forward(reply, `/api/local-admin/wishlist/${id}`, { method: "PATCH", body: JSON.stringify(request.body) });
  });

  // addresses
  app.get("/api/addresses", async (_request, reply) => forward(reply, "/api/local-admin/addresses"));
}
