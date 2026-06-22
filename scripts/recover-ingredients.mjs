// One-off: recovery amount/unit/nama recipe_ingredients dari teks mentah scraping.
// Parsing dikerjakan oleh parser KANONIK (src/utils/parseIngredient.js) — SQL hasil
// hanya berisi nilai terhitung, supaya tak ada dua sumber kebenaran (regex SQL
// terbukti merusak satuan multi-kata seperti "sendok makan").
//
// Pakai: node scripts/recover-ingredients.mjs
//   - baca recipe_ingredients via anon key (.env) — RLS "recipe_ingredients_read_public"
//   - cetak tabel review (raw → amount/unit/nama)
//   - tulis scripts/ri-recovery.sql (UPDATE per-baris) untuk di-apply terpisah
// Tidak menulis ke DB sendiri (anon read-only).

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

// Baris yang BOLEH disentuh: namanya jelas bukan bahan bersih (ada kuantitas di
// depan, atau catatan junk). Baris bersih lain tidak diproses agar amount/unit
// yang sudah benar tak tertimpa.
const isCandidate = (name) =>
  /^[^\p{L}\d]*\d/u.test(name) || /(secukupnya|sesuai selera|seperlunya|baca|caption)/i.test(name);

// Tulis hasil hanya bila benar-benar perbaikan (nama berubah & tak lagi junky).
const stillJunky = (name) => /\d/.test(name) || /(secukupnya|sesuai selera|seperlunya|baca|caption)/i.test(name);

const sqlStr = (s) => (s == null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);
const sqlNum = (n) => (n == null || Number.isNaN(n) ? "NULL" : String(n));

// Paginasi: PostgREST membatasi ~1000 baris/permintaan, recipe_ingredients > 2000.
const data = [];
for (let from = 0; ; from += 1000) {
  const { data: page, error } = await supabase
    .from("recipe_ingredients")
    .select("id, name, amount, unit")
    .order("id")
    .range(from, from + 999);
  if (error) throw error;
  data.push(...page);
  if (page.length < 1000) break;
}

const updates = [];
const skipped = [];
for (const row of data) {
  if (!isCandidate(row.name)) continue;
  const p = parseIngredient(row.name);
  const newName = p.name?.trim();
  if (!newName || stillJunky(newName) || newName.toLowerCase() === row.name.toLowerCase()) {
    skipped.push({ ...row, reason: !newName ? "kosong" : stillJunky(newName) ? "masih-junk" : "tak-berubah" });
    continue;
  }
  updates.push({ id: row.id, raw: row.name, name: newName, amount: p.amount, unit: p.unit });
}

// Review di console
console.log(`\nKandidat: ${data.filter((r) => isCandidate(r.name)).length} | update: ${updates.length} | skip: ${skipped.length}\n`);
console.log("CONTOH (raw → amount unit nama):");
for (const u of updates.slice(0, 30)) {
  console.log(`  [${u.id}] ${JSON.stringify(u.raw)} → ${u.amount ?? "·"} ${u.unit ?? "·"} | ${u.name}`);
}
console.log("\nDILEWATI (contoh):");
for (const s of skipped.slice(0, 15)) console.log(`  [${s.id}] (${s.reason}) ${JSON.stringify(s.name)}`);

// SQL keluaran
const sql = [
  "-- Dihasilkan oleh scripts/recover-ingredients.mjs (parser kanonik). Jangan edit manual.",
  "-- raw_text sudah berisi teks asli (migrasi 20260622030000). Apply via MCP/psql.",
  "begin;",
  ...updates.map(
    (u) =>
      `update public.recipe_ingredients set name=${sqlStr(u.name)}, amount=${sqlNum(u.amount)}, unit=${sqlStr(u.unit)} where id=${u.id};`
  ),
  "commit;",
  "",
].join("\n");
writeFileSync(resolve(__dirname, "ri-recovery.sql"), sql);
console.log(`\n✓ ${updates.length} UPDATE ditulis ke scripts/ri-recovery.sql`);
