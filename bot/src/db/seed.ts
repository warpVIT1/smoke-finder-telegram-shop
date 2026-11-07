import { db } from "./client.js";

type FlavourSeed = string | { name: string; sold_out?: number };

interface ProductSeed {
  id: string;
  category: string;
  name: string;
  flavour: string | null;
  price_cents: number;
  old_price_cents: number | null;
  badge: string | null;
  badge_bg: string | null;
  stock_state: string;
  stock_count: number | null;
  puffs: number | null;
  nicotine_mg: number;
  charging: string | null;
  volume_ml: number | null;
  best_seller: number;
  flavours: FlavourSeed[];
}

const products: ProductSeed[] = [
  {
    id: "fb-levelx-boost",
    category: "pods",
    name: "Flavour Beast Level X Boost",
    flavour: "Iced Mango",
    price_cents: 2799,
    old_price_cents: 3299,
    badge: "BEST",
    badge_bg: "#FF4D2E",
    stock_state: "in_stock",
    stock_count: null,
    puffs: null,
    nicotine_mg: 20,
    charging: null,
    volume_ml: null,
    best_seller: 1,
    flavours: ["Iced Mango"],
  },
  {
    id: "envi-apex-zero",
    category: "disposables",
    name: "Envi Apex",
    flavour: "Iced Mango",
    price_cents: 2499,
    old_price_cents: 2999,
    badge: "NEW",
    badge_bg: "#e9e9ed",
    stock_state: "low",
    stock_count: 7,
    puffs: 7000,
    nicotine_mg: 20,
    charging: "USB-C · 650 mAh",
    volume_ml: 16,
    best_seller: 1,
    flavours: [
      { name: "Iced Mango" },
      { name: "Blue Razz" },
      { name: "Watermelon Mint" },
      { name: "Peach Ice", sold_out: 1 },
    ],
  },
  {
    id: "mrfog-switch-sw15000",
    category: "disposables",
    name: "Mr. Fog Switch SW15000",
    flavour: "Watermelon Mint",
    price_cents: 3499,
    old_price_cents: null,
    badge: null,
    badge_bg: null,
    stock_state: "in_stock",
    stock_count: null,
    puffs: 15000,
    nicotine_mg: 20,
    charging: "USB-C",
    volume_ml: null,
    best_seller: 0,
    flavours: ["Watermelon Mint"],
  },
  {
    id: "allo-ultra-zero",
    category: "disposables",
    name: "Allo Ultra",
    flavour: "Peach Ice",
    price_cents: 2299,
    old_price_cents: 2699,
    badge: "-15%",
    badge_bg: "#d2725f",
    stock_state: "in_stock",
    stock_count: null,
    puffs: null,
    nicotine_mg: 20,
    charging: null,
    volume_ml: null,
    best_seller: 0,
    flavours: ["Peach Ice"],
  },
  {
    id: "nasty-juice-zero",
    category: "liquids",
    name: "Nasty Juice Salt",
    flavour: "Wicked Haze",
    price_cents: 2499,
    old_price_cents: null,
    badge: null,
    badge_bg: null,
    stock_state: "preorder",
    stock_count: null,
    puffs: null,
    nicotine_mg: 20,
    charging: null,
    volume_ml: 30,
    best_seller: 0,
    flavours: ["Wicked Haze"],
  },
  {
    id: "geekvape-coils-5",
    category: "accessories",
    name: "Geek Vape Coils ×5",
    flavour: null,
    price_cents: 1699,
    old_price_cents: null,
    badge: null,
    badge_bg: null,
    stock_state: "in_stock",
    stock_count: null,
    puffs: null,
    nicotine_mg: 0,
    charging: null,
    volume_ml: null,
    best_seller: 0,
    flavours: [],
  },
];

const insertProduct = db.prepare(`
  INSERT OR REPLACE INTO products
    (id, category, name, flavour, price_cents, old_price_cents, badge, badge_bg,
     stock_state, stock_count, puffs, nicotine_mg, charging, volume_ml, best_seller, sort_order)
  VALUES
    (@id, @category, @name, @flavour, @price_cents, @old_price_cents, @badge, @badge_bg,
     @stock_state, @stock_count, @puffs, @nicotine_mg, @charging, @volume_ml, @best_seller, @sort_order)
`);

const deleteFlavours = db.prepare(`DELETE FROM product_flavours WHERE product_id = ?`);
const insertFlavour = db.prepare(`
  INSERT INTO product_flavours (product_id, name, sold_out, sort_order) VALUES (?, ?, ?, ?)
`);

const seedAll = db.transaction(() => {
  products.forEach((p, index) => {
    insertProduct.run({
      id: p.id,
      category: p.category,
      name: p.name,
      flavour: p.flavour,
      price_cents: p.price_cents,
      old_price_cents: p.old_price_cents,
      badge: p.badge,
      badge_bg: p.badge_bg,
      stock_state: p.stock_state,
      stock_count: p.stock_count,
      puffs: p.puffs,
      nicotine_mg: p.nicotine_mg,
      charging: p.charging,
      volume_ml: p.volume_ml,
      best_seller: p.best_seller,
      sort_order: index,
    });
    deleteFlavours.run(p.id);
    p.flavours.forEach((f, fi) => {
      const flavour = typeof f === "string" ? { name: f, sold_out: 0 } : f;
      insertFlavour.run(p.id, flavour.name, flavour.sold_out ?? 0, fi);
    });
  });
});

seedAll();
console.log(`Seeded ${products.length} products.`);
