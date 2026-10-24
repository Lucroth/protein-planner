import { html } from "./html";
import type { Ingredient, Product, Recipe, Slot } from "./model";
import { parseKey } from "./plan";

export const SLOT_LABEL: Record<Slot, string> = { breakfast: "Śniadanie", dinner: "Obiad", supper: "Kolacja" };

export const g = (n: number) => `${Math.round(n)} g`;

export const dayLabel = (key: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  parseKey(key).toLocaleDateString("pl-PL", opts);

export const effort = (r: Recipe) => html`<span class="effort e${r.effort}" title="Trudność ${r.effort}/3">${"●".repeat(r.effort)}${"○".repeat(3 - r.effort)}</span>`;

const round = (n: number) => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10);

export const amount = (i: Ingredient, p: Product, k = 1) => `${round(i.qty * k)} ${p.unit}`;

export const packs = (n: number, p: Product) => `${n} × ${p.name}`;
