import Database from "better-sqlite3";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// DATA_DIR lets a deployment point the DB file (and uploaded product photos)
// at a mounted persistent volume (e.g. Northflank) instead of living next to
// the built code, which would otherwise be wiped on every redeploy/rebuild.
// Local dev is unaffected.
const dbPath = process.env.DATA_DIR ? join(process.env.DATA_DIR, "smoke-finder.db") : join(__dirname, "..", "..", "smoke-finder.db");
export const imagesDir = process.env.DATA_DIR
  ? join(process.env.DATA_DIR, "images")
  : join(__dirname, "..", "..", "public", "images");
mkdirSync(imagesDir, { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
db.exec(schema);

// `CREATE TABLE IF NOT EXISTS` never alters an existing table, so columns added
// to schema.sql after the db file already exists need an explicit migration here.
function ensureColumn(table: string, column: string, ddl: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}
ensureColumn("products", "active", "active INTEGER DEFAULT 1");
ensureColumn("products", "image_url", "image_url TEXT");
ensureColumn("products", "brand", "brand TEXT");
ensureColumn("products", "cost_cents", "cost_cents INTEGER");
ensureColumn("products", "sku", "sku TEXT");
ensureColumn("products", "description_en", "description_en TEXT");
ensureColumn("products", "description_uk", "description_uk TEXT");
ensureColumn("products", "description_ru", "description_ru TEXT");
ensureColumn("products", "variant_label", "variant_label TEXT DEFAULT 'flavour'");
ensureColumn("products", "points_price", "points_price INTEGER");
ensureColumn("products", "is_new", "is_new INTEGER DEFAULT 0");
ensureColumn("users", "referred_by", "referred_by INTEGER REFERENCES users(telegram_id)");
ensureColumn("users", "rewards_redeemed", "rewards_redeemed INTEGER DEFAULT 0");
ensureColumn("users", "phone", "phone TEXT");
ensureColumn("users", "discount_percent", "discount_percent INTEGER DEFAULT 0");
ensureColumn("orders", "discount_cents", "discount_cents INTEGER DEFAULT 0");
ensureColumn("orders", "payment_proof_file_id", "payment_proof_file_id TEXT");
ensureColumn("orders", "payment_confirmed", "payment_confirmed INTEGER DEFAULT 0");
ensureColumn("orders", "wallet_pay_order_id", "wallet_pay_order_id TEXT");
ensureColumn("orders", "wallet_pay_pay_link", "wallet_pay_pay_link TEXT");
ensureColumn("product_flavours", "description_en", "description_en TEXT");
ensureColumn("product_flavours", "description_uk", "description_uk TEXT");
ensureColumn("product_flavours", "description_ru", "description_ru TEXT");
ensureColumn("product_flavours", "stock_count", "stock_count INTEGER DEFAULT 0");
ensureColumn("wishlist", "paid", "paid INTEGER DEFAULT 0");

// wishlist's UNIQUE constraint was (telegram_id, product_id) — too narrow once
// a specific flavour/colour/ohm value needs recording, and SQLite can't ALTER
// a table's UNIQUE constraint in place, so this rebuilds the table when needed.
const wishlistColumns = db.prepare(`PRAGMA table_info(wishlist)`).all() as { name: string }[];
if (!wishlistColumns.some((c) => c.name === "flavour")) {
  db.exec(`
    ALTER TABLE wishlist RENAME TO wishlist_old;
    CREATE TABLE wishlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER NOT NULL REFERENCES users(telegram_id),
      product_id TEXT NOT NULL REFERENCES products(id),
      flavour TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(telegram_id, product_id, flavour)
    );
    INSERT INTO wishlist (id, telegram_id, product_id, flavour, created_at)
      SELECT id, telegram_id, product_id, '', created_at FROM wishlist_old;
    DROP TABLE wishlist_old;
  `);
}
