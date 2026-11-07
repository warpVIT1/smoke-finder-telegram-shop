import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/client.js";
import { verifyInitData, type TelegramWebAppUser } from "../lib/verifyInitData.js";

interface AddressRow {
  id: number;
  telegram_id: number;
  address: string;
  created_at: string;
}

const upsertUserStmt = db.prepare(`
  INSERT INTO users (telegram_id, first_name, username, language)
  VALUES (@id, @first_name, @username, @language)
  ON CONFLICT(telegram_id) DO UPDATE SET
    first_name = excluded.first_name,
    username = excluded.username
`);

const listStmt = db.prepare<[number]>(`SELECT * FROM addresses WHERE telegram_id = ? ORDER BY created_at DESC`);
const insertStmt = db.prepare<[number, string]>(`INSERT INTO addresses (telegram_id, address) VALUES (?, ?)`);
const deleteStmt = db.prepare<[number, number]>(`DELETE FROM addresses WHERE id = ? AND telegram_id = ?`);

function authenticate(request: FastifyRequest, reply: FastifyReply, botToken: string): TelegramWebAppUser | null {
  const initData = request.headers["x-telegram-init-data"];
  const verified = verifyInitData(typeof initData === "string" ? initData : "", botToken);
  if (!verified) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  return verified.user;
}

function serialize(row: AddressRow) {
  return { id: row.id, address: row.address, createdAt: row.created_at };
}

export function registerAddressRoutes(app: FastifyInstance, botToken: string) {
  app.get("/api/addresses", async (request, reply) => {
    const user = authenticate(request, reply, botToken);
    if (!user) return;
    return (listStmt.all(user.id) as AddressRow[]).map(serialize);
  });

  app.post("/api/addresses", async (request, reply) => {
    const user = authenticate(request, reply, botToken);
    if (!user) return;
    const body = request.body as { address?: string };
    const address = body?.address?.trim();
    if (!address) {
      reply.code(400);
      return { error: "address_required" };
    }
    upsertUserStmt.run({
      id: user.id,
      first_name: user.first_name ?? null,
      username: user.username ?? null,
      language: user.language_code ?? "en",
    });
    const result = insertStmt.run(user.id, address);
    return { id: result.lastInsertRowid, address, createdAt: new Date().toISOString() };
  });

  app.delete("/api/addresses/:id", async (request, reply) => {
    const user = authenticate(request, reply, botToken);
    if (!user) return;
    const { id } = request.params as { id: string };
    deleteStmt.run(Number(id), user.id);
    reply.code(204);
  });
}
