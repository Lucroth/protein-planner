// Fills the Uber Eats cart from the app's "Export cart JSON" file. Runs on your PC in a visible browser.
// Usage: npm run cart -- <cart-YYYY-MM-DD.json>
//
// The first run opens Uber Eats and waits: log in, set your address, open the Biedronka store page,
// then press Enter. The browser profile (scripts/cart/.profile) keeps the session for next time,
// and the store URL is remembered in scripts/cart/.profile/store-url.txt.
//
// ponytail: Uber Eats has no cart API, so this drives the page with guessed selectors (search box,
// first result, quantity +, "add to order"). When a step fails for an item it pauses and lets you add
// that item by hand, so a DOM change degrades to "assisted" instead of breaking the run.
// It never types credentials and never checks out.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { chromium, type Locator, type Page } from "playwright";

interface CartItem {
  id: string;
  name: string;
  searchTerm: string;
  packs: number;
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run cart -- <cart-YYYY-MM-DD.json>");
  process.exit(1);
}
const items = JSON.parse(readFileSync(file, "utf8")) as CartItem[];

const profile = join(dirname(fileURLToPath(import.meta.url)), ".profile");
mkdirSync(profile, { recursive: true });
const storeFile = join(profile, "store-url.txt");

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string) => rl.question(`${q} `);

const context = await chromium.launchPersistentContext(profile, { headless: false, viewport: null, locale: "pl-PL" });
const page = context.pages()[0] ?? (await context.newPage());

let store = existsSync(storeFile) ? readFileSync(storeFile, "utf8").trim() : "";
await page.goto(store || "https://www.ubereats.com/pl");
if (!store || (await ask(`Using ${store}\nPress Enter if you're logged in on that store page, or type "n" to pick it again:`)) === "n") {
  await ask("Log in, set your address and open the Biedronka store page in the browser, then press Enter here:");
  store = page.url();
  writeFileSync(storeFile, store);
}

const visible = async (candidates: Locator[]) => {
  for (const c of candidates) {
    const first = c.first();
    if (await first.isVisible().catch(() => false)) return first;
  }
  return undefined;
};

async function addItem(p: Page, item: CartItem): Promise<void> {
  await p.goto(store);
  const search = await visible([
    p.getByPlaceholder(/szukaj|search/i),
    p.getByRole("searchbox"),
    p.getByRole("combobox", { name: /szukaj|search/i }),
  ]);
  if (!search) throw new Error("no search box");
  await search.fill(item.searchTerm);
  await search.press("Enter");
  await p.waitForTimeout(2500);

  const result = await visible([p.locator('[data-testid*="store-item"], [data-testid*="menu-item"]'), p.locator("li").filter({ hasText: /zł/ })]);
  if (!result) throw new Error("no results");
  await result.click();

  const dialog = p.getByRole("dialog");
  await dialog.waitFor({ timeout: 5000 });
  for (let i = 1; i < item.packs; i++) {
    const plus = await visible([dialog.getByRole("button", { name: /zwiększ|increase|\+/i })]);
    if (!plus) throw new Error("no quantity button");
    await plus.click();
  }
  const add = await visible([dialog.getByRole("button", { name: /dodaj|add/i })]);
  if (!add) throw new Error("no add button");
  await add.click();
  await p.waitForTimeout(1500);
}

const manual: CartItem[] = [];
for (const item of items) {
  process.stdout.write(`${item.packs} × ${item.name} … `);
  try {
    await addItem(page, item);
    console.log("added (check the first result was the right product)");
  } catch (e) {
    console.log(`could not add automatically (${(e as Error).message}).`);
    const answer = await ask(`  Add "${item.searchTerm}" × ${item.packs} by hand, then press Enter (or type "s" to skip):`);
    if (answer === "s") manual.push(item);
  }
}

console.log("\nDone. Review the cart in the browser and check out yourself.");
if (manual.length) console.log(`Skipped:\n${manual.map((i) => `  ${i.packs} × ${i.name}`).join("\n")}`);
await ask("Press Enter to close the browser:");
rl.close();
await context.close();
