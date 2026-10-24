import type { Ctx } from "../ctx";
import { packs } from "../format";
import { html } from "../html";
import { addDays, mondayOf, today } from "../plan";
import { cartJson, shoppingList, uberEatsSearch, type ShopItem } from "../shop";

export async function shopPage(el: HTMLElement, ctx: Ctx, params: URLSearchParams): Promise<void> {
  const nextMonday = addDays(mondayOf(today()), 7);
  const from = params.get("from") ?? nextMonday;
  const to = params.get("to") ?? addDays(from, 6);
  const days = await ctx.store.days(from, to);
  const items = shoppingList(Object.values(days), ctx.byId, ctx.products);
  const planned = Object.values(days).reduce((n, d) => n + Object.keys(d).length, 0);

  // Ticks are per device: they are for walking the shop (or checking the fridge) on one phone.
  const key = `shop-${from}-${to}`;
  const checked = new Set<string>(read(key));
  const save = () => localStorage.setItem(key, JSON.stringify([...checked]));

  const row = (i: ShopItem) => html`<li class="${checked.has(i.id) ? "done" : ""}">
    <label><input type="checkbox" data-id="${i.id}" ${checked.has(i.id) ? "checked" : ""} />
      <span><strong>${packs(i.packs, i.product)}</strong> <span class="muted small">potrzeba ${Math.round(i.qty * 10) / 10} ${i.product.unit}</span></span>
    </label>
    <a href="${uberEatsSearch(i.product.searchTerm)}" target="_blank" rel="noopener" class="small">Uber Eats</a>
  </li>`;

  const aisles = [...new Set(items.filter((i) => !i.product.staple).map((i) => i.product.aisle))];
  const staples = items.filter((i) => i.product.staple);

  el.innerHTML = html`
    <div class="toolbar"><h1>Lista zakupów</h1></div>
    <form class="filters" id="range">
      <label>Od <input type="date" name="from" value="${from}" /></label>
      <label>Do <input type="date" name="to" value="${to}" /></label>
      <span class="muted small">zaplanowane posiłki: ${planned}</span>
    </form>
    ${items.length
      ? html`
        <div class="buttons">
          <button type="button" id="export">Eksportuj koszyk (JSON)</button>
          <button type="button" class="ghost" id="clear">Odznacz wszystko</button>
        </div>
        <p class="muted small">Zaznacz, co już masz; eksport pomija zaznaczone pozycje i podstawowe produkty ze spiżarni. Uruchom <code>npm run cart -- &lt;plik&gt;</code> w <code>scripts/</code>, żeby wypełnić koszyk w Uber Eats.</p>
        ${aisles.map((a) => html`<h2>${a}</h2><ul class="shop">${items.filter((i) => !i.product.staple && i.product.aisle === a).map(row)}</ul>`)}
        ${staples.length ? html`<details><summary>Spiżarnia (sprawdź, czy masz)</summary><ul class="shop">${staples.map(row)}</ul></details>` : ""}`
      : html`<p class="muted">Nic nie zaplanowano w tym okresie. <a href="#/week/${mondayOf(from)}">Zaplanuj tydzień</a>.</p>`}`.value;

  el.querySelector<HTMLFormElement>("#range")!.addEventListener("change", (e) => {
    const f = new FormData(e.currentTarget as HTMLFormElement);
    location.hash = `#/shop?from=${f.get("from")}&to=${f.get("to")}`;
  });
  el.querySelectorAll<HTMLInputElement>("[data-id]").forEach((c) =>
    c.addEventListener("change", () => {
      if (c.checked) checked.add(c.dataset.id!);
      else checked.delete(c.dataset.id!);
      c.closest("li")!.classList.toggle("done", c.checked);
      save();
    }),
  );
  el.querySelector("#clear")?.addEventListener("click", () => {
    checked.clear();
    save();
    void shopPage(el, ctx, params);
  });
  el.querySelector("#export")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(cartJson(items, checked), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cart-${from}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

function read(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]");
  } catch {
    return [];
  }
}
