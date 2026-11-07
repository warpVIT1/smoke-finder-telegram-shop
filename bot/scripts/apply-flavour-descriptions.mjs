import Database from "better-sqlite3";
import { describeAny } from "./flavour-lexicon.mjs";
const db = new Database("smoke-finder.db");

const rows = db.prepare(`SELECT id, name FROM product_flavours WHERE description_en IS NULL`).all();
const update = db.prepare(`UPDATE product_flavours SET description_en = ?, description_uk = ?, description_ru = ? WHERE id = ?`);

let n = 0;
const run = db.transaction(() => {
  for (const r of rows) {
    const desc = describeAny(r.name);
    if (desc) {
      update.run(desc.en, desc.uk, desc.ru, r.id);
      n++;
    }
  }
});
run();
console.log(`Updated ${n} of ${rows.length} remaining flavour rows.`);
