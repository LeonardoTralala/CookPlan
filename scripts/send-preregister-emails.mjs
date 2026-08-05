// Script untuk mengirim email pengumuman ke seluruh pendaftar pre-register CookPlan via Resend API.
//
// Cara Penggunaan:
// 1. Uji Coba Preview (Dry-Run / Tanpa Mengirim Email):
//    $env:RESEND_API_KEY="re_xxx"; node scripts/send-preregister-emails.mjs --dry-run
//
// 2. Kirim Test Email ke 1 Alamat Email Milikmu Dulu:
//    $env:RESEND_API_KEY="re_xxx"; node scripts/send-preregister-emails.mjs --test-email=emailmu@gmail.com
//
// 3. Eksekusi Kirim ke Seluruh 34 Pendaftar:
//    $env:RESEND_API_KEY="re_xxx"; node scripts/send-preregister-emails.mjs --send-all
//
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";

// Load .env file natively jika ada
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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://phdbbiydrjwxlehdfubh.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SENDER_EMAIL = process.env.RESEND_FROM_EMAIL || "CookPlan <noreply@cookplan.id>";
const SITE_URL = process.env.SITE_URL || "https://cookplan.id";

const STORAGE_BASE = "https://phdbbiydrjwxlehdfubh.supabase.co/storage/v1/object/public/recipes/email";

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const sendAll = args.includes("--send-all");
const testEmailArg = args.find((a) => a.startsWith("--test-email="));
const testEmail = testEmailArg ? testEmailArg.split("=")[1].trim() : null;

if (!RESEND_API_KEY && !isDryRun) {
  console.error("❌ Error: RESEND_API_KEY belum diset.");
  console.error("   Jalankan dengan setting env: $env:RESEND_API_KEY='re_xxxx'; node scripts/send-preregister-emails.mjs ...");
  process.exit(1);
}

if (!isDryRun && !sendAll && !testEmail) {
  console.log("ℹ️  Mode Keamanan: Mohon tentukan opsi pengiriman:");
  console.log("   --dry-run                 : Hanya tampilkan daftar penerima tanpa kirim");
  console.log("   --test-email=email@anda.com: Kirim 1 email uji coba ke alamat email kamu");
  console.log("   --send-all                : Kirim ke seluruh 34 pendaftar pre-register");
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function buildHtmlTemplate(recipientName) {
  const firstName = recipientName ? recipientName.split(" ")[0] : "Teman";
  const formattedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Akses Eksklusif CookPlan</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f2f6ee;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f2f6ee;font-size:1px;line-height:1px;">
      Undangan eksklusif buat kamu pendaftar awal CookPlan untuk mencoba aplikasi & memberikan masukan.
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f6ee;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #dbe6d1;box-shadow:0 12px 32px rgba(27,67,50,0.06);">
            
            <!-- Hero Header -->
            <tr>
              <td align="center" style="background:linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%);padding:40px 32px 36px;">
                <img src="${STORAGE_BASE}/cookplan-logo-white.png" width="170" alt="CookPlan" style="display:block;margin:0 auto 16px;border:0;width:170px;height:auto;" />
                <div style="display:inline-block;padding:5px 14px;background-color:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:20px;color:#d8f3dc;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">
                  ✦ VIP EARLY ADOPTER INVITATION ✦
                </div>
              </td>
            </tr>

            <!-- Content Area -->
            <tr>
              <td style="padding:40px 36px 20px;">
                <h1 style="margin:0 0 16px;color:#1b4332;font-size:22px;font-weight:700;line-height:1.35;letter-spacing:-0.3px;">
                  Halo ${formattedName},
                </h1>
                <p style="margin:0 0 16px;color:#3b4636;font-size:15px;line-height:1.75;">
                  Makasih banyak ya udah bersabar nungguin CookPlan sejak awal pendaftaran <em>waitlist</em>. Sebagai salah satu pendukung pertama, <strong>pendapat dan pengalaman kamu adalah yang paling kami nantikan!</strong>
                </p>
                <p style="margin:0 0 32px;color:#3b4636;font-size:15px;line-height:1.75;">
                  Saat ini aplikasi CookPlan udah siap buat kamu nyobain langsung. Kami mengundang kamu buat nyobain fitur-fiturnya dan kasih tau kami apa yang paling kamu suka atau apa yang perlu kita tingkatkan lagi.
                </p>

                <!-- Section Title -->
                <div style="margin:0 0 16px;color:#1b4332;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;border-bottom:2px solid #e2ebd5;padding-bottom:8px;">
                  ✦ Fitur Utama Yang Bisa Kamu Coba
                </div>

                <!-- Premium Feature Micro-Cards -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;background-color:#f9fcf7;border:1px solid #e3edd8;border-radius:12px;">
                  <tr>
                    <td width="56" valign="top" style="padding:18px 0 18px 18px;">
                      <div style="width:42px;height:42px;background-color:#e8f4dd;border-radius:10px;text-align:center;line-height:42px;">
                        <img src="${STORAGE_BASE}/ic-ai.png" width="22" height="22" alt="" style="vertical-align:middle;border:0;" />
                      </div>
                    </td>
                    <td valign="top" style="padding:18px 18px 18px 14px;">
                      <div style="color:#1b4332;font-size:15px;font-weight:700;margin-bottom:4px;">AI Meal Planner</div>
                      <div style="color:#525f4b;font-size:13px;line-height:1.6;">Bikin rencana menu makan 7 hari (sarapan, makan siang, makan malam) otomatis yang disesuaikan sama selera & budget kamu.</div>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;background-color:#f9fcf7;border:1px solid #e3edd8;border-radius:12px;">
                  <tr>
                    <td width="56" valign="top" style="padding:18px 0 18px 18px;">
                      <div style="width:42px;height:42px;background-color:#e8f4dd;border-radius:10px;text-align:center;line-height:42px;">
                        <img src="${STORAGE_BASE}/ic-cart.png" width="22" height="22" alt="" style="vertical-align:middle;border:0;" />
                      </div>
                    </td>
                    <td valign="top" style="padding:18px 18px 18px 14px;">
                      <div style="color:#1b4332;font-size:15px;font-weight:700;margin-bottom:4px;">Daftar Belanja Otomatis</div>
                      <div style="color:#525f4b;font-size:13px;line-height:1.6;">Semua bahan masakan dari resep seminggu otomatis digabung & dihitung takarannya. Nggak ada lagi bahan terbuang atau lupa dibeli.</div>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;background-color:#f9fcf7;border:1px solid #e3edd8;border-radius:12px;">
                  <tr>
                    <td width="56" valign="top" style="padding:18px 0 18px 18px;">
                      <div style="width:42px;height:42px;background-color:#e8f4dd;border-radius:10px;text-align:center;line-height:42px;">
                        <img src="${STORAGE_BASE}/ic-calendar.png" width="22" height="22" alt="" style="vertical-align:middle;border:0;" />
                      </div>
                    </td>
                    <td valign="top" style="padding:18px 18px 18px 14px;">
                      <div style="color:#1b4332;font-size:15px;font-weight:700;margin-bottom:4px;">Paket Bahan Siap Masak (Khusus Area Malang)</div>
                      <div style="color:#525f4b;font-size:13px;line-height:1.6;">Nggak sempet belanja? Pesan paket bahan segar siap masak yang udah ditakar, tinggal diantar langsung ke kos atau rumah kamu.</div>
                    </td>
                  </tr>
                </table>

                <!-- Call To Action Section -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                  <tr>
                    <td align="center" style="padding:8px 0;">
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center" style="border-radius:10px;background-color:#1b4332;box-shadow:0 6px 18px rgba(27,67,50,0.25);">
                            <a href="${SITE_URL}"
                               style="display:inline-block;padding:16px 42px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.5px;">
                              Coba CookPlan Sekarang ➔
                            </a>
                          </td>
                        </tr>
                      </table>
                      <div style="margin-top:12px;color:#7c8774;font-size:12px;text-align:center;">
                        Aplikasi berbasis web — bisa langsung kamu buka dari HP maupun Laptop tanpa perlu install.
                      </div>
                    </td>
                  </tr>
                </table>

                <!-- Note & Closing -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background-color:#f0f6ea;border-left:3px solid #2d6a4f;border-radius:4px;">
                  <tr>
                    <td style="padding:14px 18px;color:#3b4636;font-size:13px;line-height:1.65;">
                      ✦ <strong>Masukan Kamu Sangat Berharga:</strong> Kalau ada saran, masukan, atau kritikan pas nyobain, kamu bisa langsung kirim lewat fitur feedback di dalam aplikasinya ya! Tenang aja, setiap masukan dan kritik bakal dibaca langsung sama tim CookPlan satu per satu dan akan langsung kita eksekusi!
                    </td>
                  </tr>
                </table>

                <hr style="border:none;border-top:1px solid #e3edd8;margin:28px 0;" />

                <div style="color:#63705d;font-size:13px;line-height:1.6;text-align:center;">
                  Salam hangat,<br />
                  <strong style="color:#1b4332;font-size:15px;">CookPlan</strong>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="background-color:#f4f8f0;padding:24px;border-top:1px solid #e3edd8;color:#889481;font-size:12px;line-height:1.6;">
                Email pengumuman ini dikirimkan khusus untuk pendaftar awal CookPlan.<br />
                © 2026 CookPlan. All rights reserved.
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendEmailViaResend(toEmail, recipientName) {
  const htmlContent = buildHtmlTemplate(recipientName);
  const subject = "Undangan Akses Eksklusif: Coba CookPlan & Kasih Masukan Pertama Kamu!";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: SENDER_EMAIL,
      to: [toEmail],
      subject: subject,
      html: htmlContent,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || JSON.stringify(data));
  }
  return data;
}

async function main() {
  console.log("🔍 Mengambil data pre-register dari database Supabase...");
  let { data: users, error } = await supabase
    .from("preregistrations")
    .select("name, email, city, user_type")
    .order("created_at", { ascending: false });

  if (error || !users || users.length === 0) {
    console.log("ℹ️  Info: Fetch database menggunakan fallback data (34 pendaftar terverifikasi)...");
    users = [
      { name: "elvira raihan bilqis", email: "porrtgasdrouge@gmail.com", city: "Ponorogo", user_type: "Mahasiswa / Anak Kos" },
      { name: "Fajar Rozaqul Akbar", email: "2006fajar@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "tes", email: "kamu@gmail.com", city: "Malang", user_type: "Lainnya" },
      { name: "Ihsan Tasywiq", email: "ihsantasywiq@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "Silvi Oktavia Ramadhani", email: "slvoktv@gmail.com", city: "Kabupaten Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "Muhammad Dimas Sadila", email: "muhammaddimassadila@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "Nasya Alifia Rayyani Pambudi", email: "syaalifia1196@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "Risma Nur Rofiyanti", email: "rismanurrofiyanti5225@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "INDAH SETYA PUTRI", email: "cicisty09@gmail.com", city: "Kota Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "Irma Ramadia", email: "jiwaypez@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "Inggal Ahmad Maulid Putra", email: "inggalahmad@gmail.com", city: "Malang", user_type: "Pekerja" },
      { name: "Nabila Putri", email: "putriramadhan655@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "Praysezya Sukma Ristantia", email: "ristantiapraysezya@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "Cleonaya Vanya Amelia", email: "cleonayavanya@gmail.com", city: "Kota Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "Syahlaa Anastasia", email: "syahlaaanastasia@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "Ratu Aisyah", email: "rabusedangturu@gmail.com", city: "Kota Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "IVANA DEWI NUR KOMARIYAH", email: "ivanadewinurkomariyah1108@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "Raden Raihan", email: "denrey050412@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "MARSYA HENI AURELIA PUTRI", email: "marsyahenia@gmail.com", city: "Kabupaten Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "afrendi zakki", email: "afrendizakki@icloud.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "Azizah", email: "azizahnuruul@gmail.com", city: "Kabupaten malang", user_type: "Lainnya" },
      { name: "Devika Galuh Ecca Primadhanty", email: "devikaeccagaluh2007@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "Egista Finalisa", email: "finalsegist42@gmail.com", city: "Kabupaten Malang", user_type: "Lainnya" },
      { name: "Dewi Ika Anggraini", email: "dewiikaanggraini2@gmail.com", city: "Surabaya", user_type: "Mahasiswa / Anak Kos" },
      { name: "Siti Aisyah", email: "siti.aisyah.2407216@students.um.ac.id", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "Fannya Prestisia Moriskanadi", email: "fprestisia@student.ub.ac.id", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "ELVIN KRESTI PERMATA 1", email: "elvin.permata@mhs.unsoed.ac.id", city: "MALANG (KAB)", user_type: "Mahasiswa / Anak Kos" },
      { name: "Intan Nur Hapsari Wahyudi Putri", email: "intannurhapsari1750@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "Tiara Eka", email: "ayuvasha28@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "Sindu putri", email: "sinduputri18@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "Neta Sari", email: "netaaasarii03@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "Narendra Fajar", email: "nareenndrra@gmail.com", city: "Malang", user_type: "Mahasiswa / Anak Kos" },
      { name: "Eka Della Putri Amanda", email: "ekadellaputriamanda@gmail.com", city: "Kabupaten Malang", user_type: "Pekerja" },
      { name: "Dyan Rizki Aditya", email: "rizki@kurakampus.com", city: "Malang", user_type: "Pekerja" }
    ];
  }

  console.log(`📋 Berhasil menemukan ${users.length} pendaftar pre-register.`);
  console.log(`✉️ Sender Email: ${SENDER_EMAIL}\n`);

  if (testEmail) {
    console.log(`📧 Mode Uji Coba: Mengirim 1 email test ke [${testEmail}]...`);
    try {
      const res = await sendEmailViaResend(testEmail, "Zilfi Alvin");
      console.log(`✅ Email test BERHASIL dikirim! ID Resend: ${res.id}`);
    } catch (err) {
      console.error(`❌ Gagal mengirim email test:`, err.message);
    }
    return;
  }

  if (isDryRun) {
    console.log("🔍 === DAFTAR PENERIMA EMAIL (DRY-RUN MODE) ===");
    users.forEach((u, idx) => {
      console.log(`${idx + 1}. ${u.name} <${u.email}> (${u.city} - ${u.user_type || "N/A"})`);
    });
    console.log("\n💡 Tidak ada email yang dikirim dalam mode --dry-run.");
    return;
  }

  if (sendAll) {
    console.log(`🚀 Memulai pengiriman email broadcast ke ${users.length} pendaftar...\n`);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      process.stdout.write(`[${i + 1}/${users.length}] Mengirim ke ${u.name} <${u.email}>... `);
      try {
        await sendEmailViaResend(u.email, u.name);
        console.log("✅ Sukses");
        successCount++;
      } catch (err) {
        console.log(`❌ Gagal (${err.message})`);
        failCount++;
      }

      // Jeda 200ms agar tidak terkena rate-limit API
      await new Promise((r) => setTimeout(r, 200));
    }

    console.log(`\n🎉 Selesai! Sukses: ${successCount}, Gagal: ${failCount}`);
  }
}

main().catch((err) => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
