import { macrosOf, PROTEIN_TARGET, SLOTS, type Day, type Products, type Recipe, type Slot } from "./model";

const pad = (n: number) => String(n).padStart(2, "0");

/** Local yyyy-MM-dd, the id of a day document. */
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (key: string, n: number) => {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
};

export const mondayOf = (key: string) => addDays(key, -((parseKey(key).getDay() + 6) % 7));

export const weekDates = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

export const today = () => dateKey(new Date());

export function dayProtein(day: Day | undefined, recipes: Map<string, Recipe>, products: Products): number {
  let total = 0;
  for (const s of SLOTS) {
    const r = day?.[s] && recipes.get(day[s]!);
    if (r) total += macrosOf(r, products).protein;
  }
  return total;
}

export const missingSlots = (day: Day | undefined): Slot[] => SLOTS.filter((s) => !day?.[s]);

const MAX_PER_WEEK = 2;

/**
 * Fills the empty slots of each date, keeping what is already planned. Per day it tries every
 * combination of candidates for the empty slots and keeps the one with the best score: closeness
 * to the protein target, low effort, and recipes not used yet this week.
 * ponytail: brute force over ~10^3 combos per day, fine until the recipe list grows past ~50 per slot.
 */
export function autoFill(days: Record<string, Day>, dates: string[], recipes: Recipe[], products: Products): Record<string, Day> {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const protein = new Map(recipes.map((r) => [r.id, macrosOf(r, products).protein]));
  const used = new Map<string, number>();
  for (const d of dates) for (const s of SLOTS) if (days[d]?.[s]) used.set(days[d][s]!, (used.get(days[d][s]!) ?? 0) + 1);

  const out: Record<string, Day> = {};
  for (const date of dates) {
    const day: Day = { ...days[date] };
    const empty = missingSlots(day);
    if (!empty.length) {
      out[date] = day;
      continue;
    }
    const fixed = SLOTS.filter((s) => day[s]).map((s) => day[s]!);
    const base = dayProtein(day, byId, products);
    const options = empty.map((s) => recipes.filter((r) => r.slots.includes(s) && (used.get(r.id) ?? 0) < MAX_PER_WEEK));

    let best: { score: number; pick: Recipe[] } | undefined;
    const walk = (i: number, pick: Recipe[]) => {
      if (i === empty.length) {
        const total = base + pick.reduce((t, r) => t + protein.get(r.id)!, 0);
        const score =
          Math.abs(total - PROTEIN_TARGET) +
          pick.reduce((t, r) => t + (r.effort - 1) * 6 + (used.get(r.id) ?? 0) * 12, 0);
        if (!best || score < best.score) best = { score, pick: [...pick] };
        return;
      }
      for (const r of options[i]) {
        if (fixed.includes(r.id) || pick.includes(r)) continue;
        pick.push(r);
        walk(i + 1, pick);
        pick.pop();
      }
    };
    walk(0, []);

    best?.pick.forEach((r, i) => {
      day[empty[i]] = r.id;
      used.set(r.id, (used.get(r.id) ?? 0) + 1);
    });
    out[date] = day;
  }
  return out;
}
