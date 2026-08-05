// Script untuk mengecek status detail email dari Resend API
import { readFileSync, existsSync } from "fs";

if (existsSync(".env")) {
  const envConfig = readFileSync(".env", "utf8");
  envConfig.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...values] = trimmed.split("=");
      process.env[key.trim()] = values.join("=").trim();
    }
  });
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const targetEmail = process.argv[2] || "tizamtiyaz@gmail.com";

if (!RESEND_API_KEY) {
  console.error("❌ Error: RESEND_API_KEY belum diset.");
  process.exit(1);
}

async function checkEmailStatus() {
  console.log(`🔍 Mengecek status pengiriman di Resend untuk: [${targetEmail}]...`);

  // Fetch list of emails from Resend
  const res = await fetch("https://api.resend.com/emails", {
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("❌ Error Fetching Resend:", data);
    return;
  }

  const matchingEmails = data.data ? data.data.filter((e) => e.to && e.to.includes(targetEmail)) : [];

  if (matchingEmails.length === 0) {
    console.log(`ℹ️  Tidak ditemukan email yang dikirim ke [${targetEmail}] dalam riwayat 100 email terbaru.`);
    console.log("   (Pendaftar dengan nama tersebut mungkin terdaftar dengan email lain).");
  } else {
    console.log(`\n📋 Ditemukan ${matchingEmails.length} log email untuk [${targetEmail}]:\n`);
    matchingEmails.forEach((e, idx) => {
      console.log(`[${idx + 1}] ID        : ${e.id}`);
      console.log(`    Subject   : ${e.subject}`);
      console.log(`    From      : ${e.from}`);
      console.log(`    Status    : ${e.last_event.toUpperCase()}`);
      console.log(`    Sent At   : ${e.created_at}`);
      console.log(`---`);
    });
  }
}

checkEmailStatus().catch((err) => console.error("Fatal:", err));
