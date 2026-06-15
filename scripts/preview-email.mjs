// Render template email -> PNG untuk preview lokal.
// Ganti variabel Supabase ({{ .SiteURL }} dll) dengan nilai dummy.
import { chromium } from "playwright";
import { readFileSync, mkdirSync, existsSync } from "fs";
import { pathToFileURL } from "url";
import { resolve } from "path";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/preview-email.mjs <template.html>");
  process.exit(1);
}

const siteUrl = pathToFileURL(resolve("public")).href; // file:///.../public
// Preview: file:// subresource diblok saat setContent, jadi semua gambar di
// {{ .SiteURL }}/email/...png di-inline jadi data URI (logo + ikon).
let html = readFileSync(file, "utf8")
  .replace(/\{\{ \.SiteURL \}\}\/email\/([A-Za-z0-9_/-]+\.png)/g, (m, rel) => {
    const p = resolve("public/email", rel);
    if (!existsSync(p)) return m;
    return `data:image/png;base64,${readFileSync(p).toString("base64")}`;
  })
  .replaceAll("{{ .SiteURL }}", siteUrl)
  .replaceAll("{{ .ConfirmationURL }}", "#confirm-link-contoh")
  .replaceAll("{{ .Email }}", "kamu@email.com")
  .replaceAll("{{ .NewEmail }}", "baru@email.com")
  .replaceAll("{{ .Token }}", "428913");

mkdirSync("scripts/.preview", { recursive: true });
const out = "scripts/.preview/" + file.split(/[\\/]/).pop().replace(".html", ".png");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 680, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log("OK:", out);
