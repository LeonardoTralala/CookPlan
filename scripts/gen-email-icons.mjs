// Render ikon Material Symbols (set ikon yang dipakai app) -> PNG untuk email.
// Font ikon di-strip Gmail/Outlook, jadi di-bake jadi gambar. Warna brand #375219.
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const PRIMARY = "#375219";
const BADGE_BG = "#e8fad1";

// Badge bulat (lingkaran + ikon) di atas headline tiap template
const BADGES = {
  "badge-confirmation": "mark_email_read",
  "badge-magic_link": "login",
  "badge-recovery": "lock_reset",
  "badge-invite": "group_add",
  "badge-email_change": "alternate_email",
  "badge-reauthentication": "verified_user",
};

// Ikon inline (glyph saja, transparan) untuk kotak fitur & security
const INLINE = {
  "ic-calendar": "calendar_month",
  "ic-cart": "shopping_cart",
  "ic-ai": "auto_awesome",
  "ic-shield": "shield",
};

const FONT_HEAD = `
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@48,600,0,0&display=block" rel="stylesheet" />
  <style>
    .ms{font-family:'Material Symbols Outlined';font-weight:normal;font-style:normal;
        line-height:1;font-variation-settings:'FILL' 0,'wght' 600,'GRAD' 0,'opsz' 48;
        -webkit-font-smoothing:antialiased;}
  </style>`;

function badgeHtml(glyph) {
  return `<!doctype html><html><head>${FONT_HEAD}</head>
    <body style="margin:0;padding:0">
      <div id="cap" style="width:112px;height:112px;border-radius:56px;background:${BADGE_BG};
                           display:flex;align-items:center;justify-content:center;">
        <span class="ms" style="font-size:58px;color:${PRIMARY};">${glyph}</span>
      </div>
    </body></html>`;
}
function inlineHtml(glyph) {
  return `<!doctype html><html><head>${FONT_HEAD}</head>
    <body style="margin:0;padding:0;display:inline-block">
      <span id="cap" class="ms" style="font-size:48px;color:${PRIMARY};display:inline-block;">${glyph}</span>
    </body></html>`;
}

mkdirSync("public/email/icons", { recursive: true });
mkdirSync("scripts/.preview", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });

async function shoot(html, out) {
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForTimeout(150);
  await (await page.$("#cap")).screenshot({ path: out, omitBackground: true });
}

for (const [name, glyph] of Object.entries(BADGES)) {
  await shoot(badgeHtml(glyph), `public/email/icons/${name}.png`);
}
for (const [name, glyph] of Object.entries(INLINE)) {
  await shoot(inlineHtml(glyph), `public/email/icons/${name}.png`);
}

// Galeri preview (render langsung pakai font, biar bisa diverifikasi)
const all = { ...BADGES, ...INLINE };
const cells = Object.entries(all)
  .map(
    ([name, glyph]) => `
    <div style="text-align:center">
      <div style="width:96px;height:96px;border-radius:48px;background:${BADGE_BG};
                  display:flex;align-items:center;justify-content:center;margin:0 auto 6px;">
        <span class="ms" style="font-size:50px;color:${PRIMARY}">${glyph}</span>
      </div>
      <div style="font-family:Arial;font-size:11px;color:#44483d">${name}<br/><b>${glyph}</b></div>
    </div>`
  )
  .join("");
await page.setContent(
  `<!doctype html><html><head>${FONT_HEAD}</head>
   <body style="margin:0;padding:28px;background:#efffd9">
     <div style="display:flex;flex-wrap:wrap;gap:22px;max-width:560px">${cells}</div>
   </body></html>`,
  { waitUntil: "networkidle" }
);
await page.evaluate(async () => {
  await document.fonts.ready;
});
await page.waitForTimeout(200);
await page.screenshot({ path: "scripts/.preview/icons.png", fullPage: true });

await browser.close();
console.log(`OK: ${Object.keys(all).length} ikon -> public/email/icons/, preview -> scripts/.preview/icons.png`);
