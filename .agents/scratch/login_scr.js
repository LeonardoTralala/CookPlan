import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const email = 'testing@cookplan.id';
const pass = 'CookPlan2026!';
const siteUrl = 'https://cookplan.id';
const outputDir = './screenshots';

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Set viewport to a nice standard desktop size
  await page.setViewport({ width: 1440, height: 900 });

  console.log(`Navigating to ${siteUrl}/auth...`);
  await page.goto(`${siteUrl}/auth`, { waitUntil: 'networkidle2' });

  console.log('Filling credentials...');
  await page.waitForSelector('#email');
  await page.type('#email', email);
  await page.type('#password', pass);

  console.log('Clicking login button...');
  await page.click('button[type="submit"]');

  console.log('Waiting for navigation after login...');
  // Wait for the URL to change away from /auth or wait for a specific dashboard element
  await page.waitForFunction(
    (authUrl) => !window.location.href.includes(authUrl),
    { timeout: 15000 },
    '/auth'
  );

  console.log('Successfully logged in! Current URL:', page.url());
  await page.waitForTimeout?.(3000) || new Promise(r => setTimeout(r, 3000)); // wait a bit for transitions

  // Take screenshot of landing dashboard/catalog page (usually it redirects to /catalog or similar)
  console.log('Taking screenshot of landing page...');
  await page.screenshot({ path: path.join(outputDir, 'logged_in_landing.png'), fullPage: true });

  const pagesToScreenshot = [
    { name: 'catalog', url: `${siteUrl}/catalog` },
    { name: 'planner', url: `${siteUrl}/planner` },
    { name: 'shopping', url: `${siteUrl}/shopping` },
    { name: 'profile', url: `${siteUrl}/profile` },
    { name: 'generate', url: `${siteUrl}/generate` }
  ];

  for (const pageInfo of pagesToScreenshot) {
    try {
      console.log(`Navigating to ${pageInfo.url}...`);
      await page.goto(pageInfo.url, { waitUntil: 'networkidle2', timeout: 15000 });
      // wait a bit for any dynamic content or animations
      await new Promise(r => setTimeout(r, 2000));
      console.log(`Taking screenshot of ${pageInfo.name}...`);
      await page.screenshot({ path: path.join(outputDir, `${pageInfo.name}.png`), fullPage: true });
    } catch (err) {
      console.error(`Failed to screenshot ${pageInfo.name}:`, err.message);
    }
  }

  console.log('Done!');
  await browser.close();
}

run().catch(err => {
  console.error('Error during execution:', err);
  process.exit(1);
});
