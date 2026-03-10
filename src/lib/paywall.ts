import { chromium, type Browser, type Page } from 'playwright';
import fs from 'fs';
import path from 'path';

const CHROMIUM_PATH = '/home/reidsurmeier/.local/bin/chromium';
const CREDENTIALS_PATH = path.join(process.cwd(), '.credentials', 'logins.json');

interface SiteCredentials {
  username: string;
  password: string;
  uri: string;
}

interface Credentials {
  nyt?: SiteCredentials;
  newyorker?: SiteCredentials;
  atlantic?: SiteCredentials;
  nymag?: SiteCredentials;
}

function loadCredentials(): Credentials {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.warn(`[paywall] No credentials file at ${CREDENTIALS_PATH}`);
    return {};
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
}

// ── Site-specific login flows ──

async function loginNYT(page: Page, creds: SiteCredentials): Promise<void> {
  await page.goto('https://myaccount.nytimes.com/auth/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="email"]', creds.username);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  await page.fill('input[name="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
}

async function loginNewYorker(page: Page, creds: SiteCredentials): Promise<void> {
  await page.goto('https://www.newyorker.com/auth/initiate', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"]', creds.username);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  await page.fill('input[type="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
}

async function loginAtlantic(page: Page, creds: SiteCredentials): Promise<void> {
  await page.goto('https://accounts.theatlantic.com/login/', { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="email"]', creds.username);
  await page.fill('input[name="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
}

async function loginNYMag(page: Page, creds: SiteCredentials): Promise<void> {
  await page.goto('https://nymag.com/account/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', creds.username);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  await page.fill('input[type="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
}

// ── Map source names to login functions ──

type SourceKey = 'nyt' | 'newyorker' | 'atlantic' | 'nymag';

const PAYWALL_SOURCES: Record<string, { key: SourceKey; login: (page: Page, creds: SiteCredentials) => Promise<void> }> = {
  'NYT Arts': { key: 'nyt', login: loginNYT },
  'NYT T Magazine': { key: 'nyt', login: loginNYT },
  'The New Yorker': { key: 'newyorker', login: loginNewYorker },
  'The Atlantic': { key: 'atlantic', login: loginAtlantic },
  'NY Mag': { key: 'nymag', login: loginNYMag },
};

// ── Check if a source requires paywall login ──

export function isPaywalled(source: string): boolean {
  return source in PAYWALL_SOURCES;
}

// ── Login to a paywalled site ──

export async function loginToSite(page: Page, source: string): Promise<boolean> {
  const config = PAYWALL_SOURCES[source];
  if (!config) return false;

  const creds = loadCredentials();
  const siteCreds = creds[config.key];
  if (!siteCreds) {
    console.warn(`[paywall] No credentials for ${source} (key: ${config.key})`);
    return false;
  }

  console.log(`[paywall] Logging in to ${source}...`);
  try {
    await config.login(page, siteCreds);
    console.log(`[paywall] Login complete for ${source}`);
    return true;
  } catch (err) {
    console.error(`[paywall] Login failed for ${source}: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

// ── Fetch a paywalled article: login first, then navigate ──

export async function fetchPaywalledArticle(url: string, source: string): Promise<string> {
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login first
    const loggedIn = await loginToSite(page, source);
    if (!loggedIn) {
      console.warn(`[paywall] Proceeding without login for ${source}`);
    }

    // Navigate to the article
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    const html = await page.content();
    return html;
  } finally {
    if (browser) await browser.close();
  }
}
