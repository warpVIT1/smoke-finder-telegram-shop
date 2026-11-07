CREATE TABLE IF NOT EXISTS users (
  telegram_id INTEGER PRIMARY KEY,
  first_name TEXT,
  username TEXT,
  language TEXT DEFAULT 'en',
  points INTEGER DEFAULT 0,
  member_since TEXT DEFAULT (datetime('now')),
  age_confirmed_at TEXT,
  referred_by INTEGER REFERENCES users(telegram_id),
  rewards_redeemed INTEGER DEFAULT 0,
  phone TEXT,
  discount_percent INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,          -- disposables | liquids | pods | accessories
  name TEXT NOT NULL,
  flavour TEXT,
  price_cents INTEGER NOT NULL,
  old_price_cents INTEGER,
  badge TEXT,
  badge_bg TEXT,
  stock_state TEXT NOT NULL,       -- in_stock | low | preorder
  stock_count INTEGER,
  puffs INTEGER,
  nicotine_mg INTEGER DEFAULT 0,
  charging TEXT,
  volume_ml INTEGER,
  best_seller INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  image_url TEXT,
  brand TEXT,
  cost_cents INTEGER,
  sku TEXT,
  description_en TEXT,
  description_uk TEXT,
  description_ru TEXT,
  variant_label TEXT DEFAULT 'flavour',
  points_price INTEGER,
  is_new INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_flavours (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  sold_out INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  description_en TEXT,
  description_uk TEXT,
  description_ru TEXT,
  stock_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER NOT NULL REFERENCES users(telegram_id),
  status TEXT NOT NULL DEFAULT 'placed',   -- placed | accepted | packed | ready_pickup | delivered | cancelled
  delivery_method TEXT NOT NULL,           -- courier | pickup
  payment_method TEXT NOT NULL,            -- e_transfer | cash | wallet_pay
  contact_name TEXT,
  contact_phone TEXT,
  address TEXT,
  subtotal_cents INTEGER NOT NULL,
  shipping_cents INTEGER NOT NULL,
  tax_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  discount_cents INTEGER DEFAULT 0,
  promo_code TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  payment_proof_file_id TEXT,
  payment_confirmed INTEGER DEFAULT 0,
  wallet_pay_order_id TEXT,
  wallet_pay_pay_link TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  flavour TEXT,
  qty INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS wishlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER NOT NULL REFERENCES users(telegram_id),
  product_id TEXT NOT NULL REFERENCES products(id),
  flavour TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  paid INTEGER DEFAULT 0,
  UNIQUE(telegram_id, product_id, flavour)
);

CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER NOT NULL REFERENCES users(telegram_id),
  address TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
