import { describe, expect, it } from "vitest";
import data from "../public/recipes.json";
import { PROTEIN_TARGET, SLOTS, type Products, type Recipe } from "./model";
import { autoFill, dayProtein, mondayOf, weekDates } from "./plan";
import { cartJson, shoppingList } from "./shop";

const products = data.products as Products;
const recipes = data.recipes as Recipe[];
const byId = new Map(recipes.map((r) => [r.id, r]));

describe("week math", () => {
  it("starts weeks on Monday", () => {
    expect(mondayOf("2026-10-25")).toBe("2026-10-19");
    expect(mondayOf("2026-10-19")).toBe("2026-10-19");
    expect(weekDates("2026-10-26")).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
  });
});

describe("autoFill", () => {
  const dates = weekDates("2026-10-26");

  it("fills every slot near the protein target, max twice per recipe a week", () => {
    const week = autoFill({}, dates, recipes, products);
    const counts = new Map<string, number>();
    for (const d of dates) {
      for (const s of SLOTS) {
        const id = week[d][s]!;
        expect(byId.get(id)!.slots).toContain(s);
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      expect(Math.abs(dayProtein(week[d], byId, products) - PROTEIN_TARGET)).toBeLessThanOrEqual(15);
    }
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
  });

  it("keeps what is already planned", () => {
    const week = autoFill({ [dates[0]]: { dinner: "tuna-pasta" } }, dates, recipes, products);
    expect(week[dates[0]].dinner).toBe("tuna-pasta");
    expect(week[dates[0]].breakfast).toBeTruthy();
  });
});

describe("shoppingList", () => {
  it("sums across meals and rounds up to packs", () => {
    const items = shoppingList([{ breakfast: "skyr-bowl" }, { breakfast: "skyr-bowl", supper: "tuna-sandwich" }], byId, products);
    const skyr = items.find((i) => i.id === "skyr")!;
    expect(skyr.qty).toBe(650);
    expect(skyr.packs).toBe(5);
    expect(items.find((i) => i.id === "tunczyk")!.packs).toBe(1);
  });

  it("leaves staples and ticked items out of the cart", () => {
    const items = shoppingList([{ breakfast: "scrambled-ham" }], byId, products);
    const cart = cartJson(items, new Set(["pomidorki"]));
    expect(cart.map((c) => c.id).sort()).toEqual(["jajka", "szynka-indyk"]);
  });
});

describe("parseSteps", () => {
  it("reads trailing timers and round-trips", async () => {
    const { parseSteps, formatSteps } = await import("./pages/add");
    const steps = parseSteps("Boil water\nCook pasta [10 min]\n\nRest [90 s]\nServe [1,5 min]");
    expect(steps).toEqual([{ text: "Boil water" }, { text: "Cook pasta", timerSec: 600 }, { text: "Rest", timerSec: 90 }, { text: "Serve", timerSec: 90 }]);
    expect(parseSteps(formatSteps(steps))).toEqual(steps);
  });
});
