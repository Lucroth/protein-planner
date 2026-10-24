# Protein Planner

Plan three high-protein meals a day (breakfast, dinner, supper) to hit ~140 g of protein, a week at a time, with low-effort recipes first. Installable on a phone as a PWA.

- **Week view**: tap a slot to pick a recipe, see protein per day against 140 g, auto-fill the empty slots.
- **Cook mode**: one step per screen, timers that keep running across steps (beep + vibrate), the screen stays on.
- **Shopping list**: what the planned meals need, rounded up to packs and grouped by aisle, with Uber Eats search links and a cart export.
- **Reminder**: an email at 18:00 (Warsaw time) when tomorrow has empty slots, and on Sundays when next week is mostly unplanned.

Macros come from typical label values in `web/public/recipes.json` and are only estimates.

## Layout

- `web/`: Vite + TS static site. Without Firebase config it runs on localStorage only; with config it signs in with Google and stores everything under `users/{uid}` in Firestore.
- `scripts/notify.ts`: the reminder, run by `.github/workflows/notify.yml`.
- `scripts/cart/cart.ts`: fills the Uber Eats cart on your PC (see below).

## Run locally

```bash
cd web && npm install && npm run dev
```

## Setup (once)

1. Create a Firebase project, enable **Authentication → Google** and **Firestore**, add `lucroth.github.io` to the authorized domains.
2. Deploy the rules: `npx firebase-tools deploy --only firestore:rules --project <id>`.
3. Repository variables (public web config): `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID`.
4. Repository secrets: `FIREBASE_SERVICE_ACCOUNT` (service account JSON), `GMAIL_USER`, `GMAIL_APP_PASSWORD`.
5. Settings → Pages → Source: GitHub Actions.

## Uber Eats cart

Uber Eats has no public cart API, so `cart.ts` drives a visible Chromium with Playwright.

1. In the app, open Shop and pick the week. Tick what you already have, then **Export cart JSON**.
2. Run:
   ```bash
   cd scripts && npm install && npx playwright install chromium
   npm run cart -- path/to/cart-2026-10-26.json
   ```
3. On the first run, log in, set your address and open the Biedronka store page, then press Enter in the terminal. The session and store URL are kept in `scripts/cart/.profile/`.

For each item the script searches the store and adds the first result. When it can't (page changed, CAPTCHA, no match), it pauses so you can add that item yourself. It never checks out. Automating the site may break their terms, so use at your own risk.
