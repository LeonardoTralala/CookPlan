// Konversi public/cookplan-logo.svg -> PNG untuk header email.
// Email client (Gmail/Outlook) tidak render SVG, jadi perlu PNG.
// Logo asli fill #2C3A1E (hijau gelap) -> direcolor jadi putih untuk header gelap.
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "fs";

const RAW = readFileSync("public/cookplan-logo.svg", "utf8");
// viewBox="160 145 1180 700" -> ratio 1180:700.
// Tampil 160px di email; render 480px (3x) -> tajam di retina, file kecil.
const W = 480;
const H = Math.round((W * 700) / 1180); // 285

function sized(svg, fill) {
  return svg
    .replaceAll("#2C3A1E", fill)
    .replace("<svg ", `<svg width="${W}" height="${H}" `);
}

const whiteSvg = sized(RAW, "#FFFFFF");
const darkSvg = sized(RAW, "#2C3A1E");

mkdirSync("public/email", { recursive: true });
mkdirSync("scripts/.preview", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

// 1) Logo putih, background transparan -> dipakai di email
await page.setContent(`<!doctype html><html><body style="margin:0;padding:0">${whiteSvg}</body></html>`);
await (await page.$("svg")).screenshot({
  path: "public/email/cookplan-logo-white.png",
  omitBackground: true,
});

// 2) Logo hijau, transparan -> cadangan (kalau butuh header terang)
await page.setContent(`<!doctype html><html><body style="margin:0;padding:0">${darkSvg}</body></html>`);
await (await page.$("svg")).screenshot({
  path: "public/email/cookplan-logo-dark.png",
  omitBackground: true,
});

// 3) Preview: logo putih di atas warna header #375219 (buat verifikasi visual)
const previewW = 360;
const previewH = Math.round((previewW * 700) / 1180);
const previewSvg = RAW.replaceAll("#2C3A1E", "#FFFFFF").replace(
  "<svg ",
  `<svg width="${previewW}" height="${previewH}" `
);
await page.setContent(
  `<!doctype html><html><body style="margin:0;padding:0;background:#375219">
     <div id="cap" style="display:inline-block;padding:32px 48px;background:#375219">${previewSvg}</div>
   </body></html>`
);
await (await page.$("#cap")).screenshot({ path: "scripts/.preview/header-preview.png" });

await browser.close();
console.log(`OK: cookplan-logo-white.png (${W}x${H}), cookplan-logo-dark.png, header-preview.png`);
