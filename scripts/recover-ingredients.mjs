// One-off: recovery + RE-LINK recipe_ingredients dari teks mentah scraping.
//
// Parsing dikerjakan oleh parser KANONIK (src/utils/parseIngredient.js) — SQL hasil
// hanya berisi nilai terhitung, supaya tak ada dua sumber kebenaran (regex SQL
// terbukti merusak satuan multi-kata seperti "sendok makan").
//
// Strategi (konservatif & aman):
//   - HANYA sentuh baris yang BELUM kehitung (ingredient master-nya tak berharga /
//     ingredient_id NULL). Baris yang sudah ber-harga tidak diganggu.
//   - Parse nama mentah → {amount, unit, name}. Resolve `name` ke master KANONIK
//     via nama persis atau tabel ingredient_aliases.
//   - Tulis UPDATE hanya bila resolve ke kanonik BERHARGA & berbeda (re-link) →
//     dijamin baris itu jadi terhitung. amount/unit lama dipertahankan bila parser
//     tak menemukan yang baru (mis. "grm ayam" amount sudah 250 di kolom).
//
// Pakai: node scripts/recover-ingredients.mjs
//   - baca via anon key (.env), tidak menulis ke DB (anon read-only)
//   - tulis scripts/ri-recovery.sql (UPDATE per-baris) untuk di-apply terpisah (MCP/psql)

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseIngredient } from "../src/utils/parseIngredient.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// .env sederhana (tanpa dependency dotenv).
const env = Object.fromEntries(
  readFileSync(resolve(root, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const sqlStr = (s) => (s == null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);
const sqlNum = (n) => (n == null || Number.isNaN(Number(n)) ? "NULL" : String(n));
const stillJunky = (name) => /\d/.test(name) || /(secukupnya|sesuai selera|seperlunya|baca|caption)/i.test(name);
const norm = (s) => String(s ?? "").trim().toLowerCase();

// Ambil semua baris sebuah tabel dengan paginasi (PostgREST batas ~1000/permintaan).
// orderCol harus kolom yang ada (ingredient_aliases tak punya `id`).
async function fetchAll(table, columns, orderCol = "id") {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).order(orderCol).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

// --- Master + alias → resolver nama → { id, name, priced } ---
const ingredients = await fetchAll("ingredients", "id, name, price_per_base");
const byId = new Map(ingredients.map((i) => [i.id, i]));
const priced = (ing) => !!ing && ing.price_per_base != null;

const resolver = new Map(); // norm(nama/alias) → ingredient row
for (const i of ingredients) resolver.set(norm(i.name), i);

let aliasCount = 0;
try {
  const aliases = await fetchAll("ingredient_aliases", "alias, ingredient_id", "alias");
  for (const a of aliases) {
    const ing = byId.get(a.ingredient_id);
    if (ing && !resolver.has(norm(a.alias))) resolver.set(norm(a.alias), ing);
    aliasCount++;
  }
} catch (e) {
  console.warn(`! alias tidak terbaca (lanjut nama-saja): ${e.message}`);
}

const rows = await fetchAll("recipe_ingredients", "id, name, amount, unit, ingredient_id");

const updates = [];
const skipped = { sudah_harga: 0, tak_resolve: 0, masih_junk: 0, sama: 0, ke_unpriced: 0 };
for (const row of rows) {
  if (priced(byId.get(row.ingredient_id))) { skipped.sudah_harga++; continue; } // sudah kehitung
  const p = parseIngredient(row.name);
  if (!p.name || stillJunky(p.name)) { skipped.masih_junk++; continue; }
  const hit = resolver.get(norm(p.name));
  if (!hit) { skipped.tak_resolve++; continue; }
  if (!priced(hit)) { skipped.ke_unpriced++; continue; } // kanonik ada tapi belum berharga → tak menjamin terhitung
  if (hit.id === row.ingredient_id) { skipped.sama++; continue; }
  updates.push({
    id: row.id,
    raw: row.name,
    ingredient_id: hit.id,
    canon: hit.name,
    name: p.name,
    amount: p.amount ?? row.amount, // pertahankan amount lama bila parser tak temukan
    unit: p.unit ?? row.unit,
  });
}

console.log(`\nMaster: ${ingredients.length} (berharga ${ingredients.filter(priced).length}) | alias: ${aliasCount} | recipe_ingredients: ${rows.length}`);
console.log(`RE-LINK: ${updates.length} | skip: ${JSON.stringify(skipped)}\n`);
console.log("CONTOH (raw → amount unit | nama → KANONIK):");
for (const u of updates.slice(0, 30)) {
  console.log(`  [${u.id}] ${JSON.stringify(u.raw)} → ${u.amount ?? "·"} ${u.unit ?? "·"} | ${u.name} → ${u.canon} (#${u.ingredient_id})`);
}

const sql = [
  "-- Dihasilkan oleh scripts/recover-ingredients.mjs (parser kanonik + re-link alias).",
  "-- Jangan edit manual. Apply via MCP/psql. Trigger ri_before_change recompute price_idr.",
  "begin;",
  ...updates.map(
    (u) =>
      `update public.recipe_ingredients set ingredient_id=${u.ingredient_id}, name=${sqlStr(u.name)}, amount=${sqlNum(u.amount)}, unit=${sqlStr(u.unit)} where id=${u.id};`
  ),
  "commit;",
  "",
].join("\n");
writeFileSync(resolve(__dirname, "ri-recovery.sql"), sql);
console.log(`\n✓ ${updates.length} UPDATE ditulis ke scripts/ri-recovery.sql`);
