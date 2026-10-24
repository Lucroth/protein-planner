import type { Day, Product, Products, Recipe } from "./model";

/** users/{uid}/days, /recipes, /products in Firestore; or one localStorage blob when Firebase isn't configured. */
export interface Store {
  days(from: string, to: string): Promise<Record<string, Day>>;
  saveDays(days: Record<string, Day>): Promise<void>;
  recipes(): Promise<Recipe[]>;
  saveRecipe(r: Recipe): Promise<void>;
  deleteRecipe(id: string): Promise<void>;
  products(): Promise<Products>;
  saveProduct(id: string, p: Product): Promise<void>;
}

export const firebaseConfigured = !!import.meta.env.VITE_FIREBASE_PROJECT_ID;

interface Blob {
  days: Record<string, Day>;
  recipes: Record<string, Recipe>;
  products: Products;
}

export function localStore(): Store {
  const KEY = "protein-planner";
  const load = (): Blob => {
    try {
      return { days: {}, recipes: {}, products: {}, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
    } catch {
      return { days: {}, recipes: {}, products: {} };
    }
  };
  const update = async (f: (b: Blob) => void) => {
    const b = load();
    f(b);
    localStorage.setItem(KEY, JSON.stringify(b));
  };
  return {
    days: async (from, to) => Object.fromEntries(Object.entries(load().days).filter(([k]) => k >= from && k <= to)),
    saveDays: (days) => update((b) => Object.assign(b.days, days)),
    recipes: async () => Object.values(load().recipes),
    saveRecipe: (r) => update((b) => void (b.recipes[r.id] = r)),
    deleteRecipe: (id) => update((b) => void delete b.recipes[id]),
    products: async () => load().products,
    saveProduct: (id, p) => update((b) => void (b.products[id] = p)),
  };
}
