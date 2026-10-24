export const SLOTS = ["breakfast", "dinner", "supper"] as const;
export type Slot = (typeof SLOTS)[number];

export const PROTEIN_TARGET = 140;

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** `per` is per 100 g / 100 ml, or per piece for "szt". */
export interface Product {
  name: string;
  searchTerm: string;
  unit: "g" | "ml" | "szt";
  packSize: number;
  aisle: string;
  per: Macros;
  staple?: boolean;
}

export interface Ingredient {
  product: string;
  qty: number;
  note?: string;
}

export interface Step {
  text: string;
  timerSec?: number;
}

/** One portion. */
export interface Recipe {
  id: string;
  name: string;
  slots: Slot[];
  effort: 1 | 2 | 3;
  minutes: number;
  ingredients: Ingredient[];
  steps: Step[];
  custom?: boolean;
}

export type Products = Record<string, Product>;

export type Day = Partial<Record<Slot, string>>;

export const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export const addMacros = (a: Macros, b: Macros, k = 1): Macros => ({
  kcal: a.kcal + b.kcal * k,
  protein: a.protein + b.protein * k,
  carbs: a.carbs + b.carbs * k,
  fat: a.fat + b.fat * k,
});

const factor = (p: Product, qty: number) => (p.unit === "szt" ? qty : qty / 100);

export const macrosOf = (r: Recipe, products: Products): Macros =>
  r.ingredients.reduce((m, i) => {
    const p = products[i.product];
    return p ? addMacros(m, p.per, factor(p, i.qty)) : m;
  }, ZERO);
