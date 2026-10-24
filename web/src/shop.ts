import { SLOTS, type Day, type Product, type Products, type Recipe } from "./model";

export interface ShopItem {
  id: string;
  product: Product;
  qty: number;
  packs: number;
}

/** Everything the planned meals need, summed per product and rounded up to whole packs, sorted by aisle. */
export function shoppingList(days: Day[], recipes: Map<string, Recipe>, products: Products): ShopItem[] {
  const qty = new Map<string, number>();
  for (const day of days)
    for (const s of SLOTS) {
      const r = day[s] && recipes.get(day[s]!);
      if (r) for (const i of r.ingredients) qty.set(i.product, (qty.get(i.product) ?? 0) + i.qty);
    }
  return [...qty]
    .filter(([id]) => products[id])
    .map(([id, q]) => ({ id, product: products[id], qty: q, packs: Math.ceil(q / products[id].packSize - 1e-9) }))
    .sort((a, b) => a.product.aisle.localeCompare(b.product.aisle) || a.product.name.localeCompare(b.product.name));
}

/** What the local cart script reads: staples and ticked-off items left out. */
export const cartJson = (items: ShopItem[], skip: Set<string>) =>
  items
    .filter((i) => !i.product.staple && !skip.has(i.id))
    .map((i) => ({ id: i.id, name: i.product.name, searchTerm: i.product.searchTerm, packs: i.packs }));

export const uberEatsSearch = (term: string) => `https://www.ubereats.com/pl/search?q=${encodeURIComponent(term)}`;
