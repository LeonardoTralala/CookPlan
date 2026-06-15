// Kirim email test (recovery / magic link) ke alamat sendiri untuk cek template.
// Pakai anon key dari .env (aman, key publik). Hanya bisa untuk user yang sudah ada.
//
//   node scripts/send-test-emails.mjs recovery you@email.com
//   node scripts/send-test-emails.mjs magic    you@email.com
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

function env(key) {
  const line = readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(key + "="));
  if (!line) throw new Error(`${key} tidak ada di .env`);
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
}

const SITE = "https://cook-plan-pimnas-2026.vercel.app";
const type = process.argv[2];
const email = process.argv[3];

if (!email || !["recovery", "magic"].includes(type)) {
  console.error("Usage: node scripts/send-test-emails.mjs <recovery|magic> <email>");
  process.exit(1);
}

const supabase = createClient(env("VITE_SUPABASE_URL"), env("VITE_SUPABASE_ANON_KEY"));

const { error } =
  type === "recovery"
    ? await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${SITE}/auth` })
    : await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: `${SITE}/catalog` },
      });

if (error) {
  console.error("GAGAL:", error.message);
  process.exit(1);
}
console.log(`OK: email '${type}' dikirim ke ${email}. Cek inbox (dan folder spam).`);
