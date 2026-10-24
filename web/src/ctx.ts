import { macrosOf, type Macros, type Products, type Recipe } from "./model";
import type { Store } from "./store";

export interface Ctx {
  store: Store;
  products: Products;
  recipes: Recipe[];
  byId: Map<string, Recipe>;
  macros: (r: Recipe) => Macros;
  reload(): Promise<void>;
}

/** Seed recipes from recipes.json plus the user's own; a custom recipe with a seed id replaces it. */
export async function createCtx(store: Store): Promise<Ctx> {
  const seed = (await (await fetch("./recipes.json")).json()) as { products: Products; recipes: Recipe[] };
  const ctx: Ctx = {
    store,
    products: {},
    recipes: [],
    byId: new Map(),
    macros: (r) => macrosOf(r, ctx.products),
    async reload() {
      const [products, recipes] = await Promise.all([store.products(), store.recipes()]);
      ctx.products = { ...seed.products, ...products };
      ctx.byId = new Map([...seed.recipes, ...recipes.map((r) => ({ ...r, custom: true }))].map((r) => [r.id, r]));
      ctx.recipes = [...ctx.byId.values()];
    },
  };
  await ctx.reload();
  return ctx;
}

export const sortForSlot = (ctx: Ctx, list: Recipe[]) =>
  [...list].sort((a, b) => a.effort - b.effort || ctx.macros(b).protein - ctx.macros(a).protein);
