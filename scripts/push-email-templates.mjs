// Apply template email CookPlan ke Supabase via Management API.
// HANYA mengubah field mailer_* (subject + isi template). TIDAK menyentuh
// Site URL, SMTP (Resend), OAuth, atau setting auth lain. Aman untuk produksi.
//
// Cara pakai (token tidak masuk chat, tetap di sesi kamu):
//   1) Buat Personal Access Token: https://supabase.com/dashboard/account/tokens
//   2) Jalankan di terminal:
//        $env:SUPABASE_ACCESS_TOKEN='sbp_xxx'; node scripts/push-email-templates.mjs
//      (atau set PROJECT_REF=... untuk override ref default)
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

const REF = process.env.PROJECT_REF || "phdbbiydrjwxlehdfubh";

function getToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN.trim();
  // Fallback: token tersimpan dari `npx supabase login` (kalau berupa file)
  const p = resolve(homedir(), ".supabase", "access-token");
  if (existsSync(p)) return readFileSync(p, "utf8").trim();
  throw new Error(
    "Token tidak ditemukan. Set SUPABASE_ACCESS_TOKEN atau jalankan `npx supabase login`."
  );
}

const DIR = "supabase/templates";
const tpl = (f) => readFileSync(resolve(DIR, f), "utf8");

// Subject samakan dengan supabase/config.toml
const body = {
  mailer_subjects_confirmation: "Konfirmasi pendaftaran CookPlan 🍳",
  mailer_templates_confirmation_content: tpl("confirmation.html"),
  mailer_subjects_invite: "Kamu diundang bergabung di CookPlan 🎉",
  mailer_templates_invite_content: tpl("invite.html"),
  mailer_subjects_magic_link: "Tautan masuk CookPlan 🔑",
  mailer_templates_magic_link_content: tpl("magic_link.html"),
  mailer_subjects_recovery: "Reset password CookPlan 🔒",
  mailer_templates_recovery_content: tpl("recovery.html"),
  mailer_subjects_email_change: "Konfirmasi perubahan email CookPlan ✉️",
  mailer_templates_email_change_content: tpl("email_change.html"),
  mailer_subjects_reauthentication: "Kode verifikasi CookPlan 🔐",
  mailer_templates_reauthentication_content: tpl("reauthentication.html"),
};

const token = getToken();
const url = `https://api.supabase.com/v1/projects/${REF}/config/auth`;

const res = await fetch(url, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

if (!res.ok) {
  console.error("GAGAL:", res.status, res.statusText);
  console.error(await res.text());
  process.exit(1);
}

console.log(`OK: 6 template email ter-apply ke project ${REF}.`);
console.log("Cek di Dashboard -> Authentication -> Emails -> Templates.");
