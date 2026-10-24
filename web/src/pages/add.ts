import type { Ctx } from "../ctx";
import { g, SLOT_LABEL } from "../format";
import { html } from "../html";
import { macrosOf, SLOTS, type Ingredient, type Product, type Recipe, type Slot, type Step } from "../model";

const TIMER = /\s*\[(\d+(?:[.,]\d+)?)\s*(min|m|s|sec)\]\s*$/i;

/** One step per line; a trailing "[5 min]" or "[90 s]" becomes the step's timer. */
export function parseSteps(text: string): Step[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(TIMER);
      if (!m) return { text: line };
      const n = Number(m[1].replace(",", "."));
      return { text: line.replace(TIMER, ""), timerSec: Math.round(m[2].toLowerCase().startsWith("m") ? n * 60 : n) };
    });
}

export const formatSteps = (steps: Step[]) =>
  steps.map((s) => (s.timerSec ? `${s.text} [${s.timerSec % 60 ? `${s.timerSec} s` : `${s.timerSec / 60} min`}]` : s.text)).join("\n");

const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function addPage(el: HTMLElement, ctx: Ctx, sourceId: string | null, onSaved: (id: string) => void): void {
  const src = sourceId ? ctx.byId.get(sourceId) : undefined;
  let rows: Ingredient[] = src ? src.ingredients.map((i) => ({ ...i })) : [{ product: "", qty: 0 }];
  const productOptions = () =>
    Object.entries(ctx.products)
      .sort(([, a], [, b]) => a.name.localeCompare(b.name, "pl"))
      .map(([id, p]) => html`<option value="${id}">${p.name}</option>`);

  el.innerHTML = html`
    <p class="back"><a href="${src ? `#/recipe/${src.id}` : "#/recipes"}">‹ Wstecz</a></p>
    <h1>${src?.custom ? "Edytuj przepis" : src ? `Kopia: ${src.name}` : "Nowy przepis"}</h1>
    <form id="recipe" class="form">
      <label>Nazwa <input name="name" required value="${src ? (src.custom ? src.name : `${src.name} (mój)`) : ""}" /></label>
      <fieldset><legend>Posiłki</legend>
        ${SLOTS.map((s) => html`<label class="inline"><input type="checkbox" name="slots" value="${s}" ${src?.slots.includes(s) ? "checked" : ""} /> ${SLOT_LABEL[s]}</label>`)}
      </fieldset>
      <div class="row">
        <label>Trudność <select name="effort">${[1, 2, 3].map((n) => html`<option value="${n}" ${src?.effort === n ? "selected" : ""}>${["", "Łatwy", "Średni", "Pracochłonny"][n]}</option>`)}</select></label>
        <label>Minuty <input name="minutes" type="number" min="1" required value="${src?.minutes ?? 10}" /></label>
      </div>
      <fieldset><legend>Składniki (jedna porcja)</legend>
        <div id="rows"></div>
        <button type="button" class="ghost" id="add-row">+ Składnik</button>
        <p id="macros" class="muted"></p>
      </fieldset>
      <label>Kroki <span class="muted small">jeden w linii, minutnik dodasz na końcu: [5 min] albo [90 s]</span>
        <textarea name="steps" rows="8" required>${src ? formatSteps(src.steps) : ""}</textarea>
      </label>
      <p id="error" class="error"></p>
      <button type="submit" class="big">Zapisz przepis</button>
    </form>
    <details class="card"><summary>Brakuje produktu? Dodaj go</summary>
      <form id="product" class="form">
        <label>Nazwa <input name="name" required placeholder="Skyr waniliowy 150 g" /></label>
        <label>Fraza do wyszukania w Uber Eats <input name="searchTerm" required placeholder="skyr waniliowy" /></label>
        <div class="row">
          <label>Jednostka <select name="unit"><option value="g">g</option><option value="ml">ml</option><option value="szt">szt</option></select></label>
          <label>Wielkość opakowania <input name="packSize" type="number" min="1" step="any" required /></label>
          <label>Dział <input name="aisle" list="aisles" required /></label>
        </div>
        <p class="muted small">Na 100 g / 100 ml albo na sztukę:</p>
        <div class="row">
          ${([["kcal", "kcal"], ["protein", "białko"], ["carbs", "węglowodany"], ["fat", "tłuszcz"]] as const).map(([k, label]) => html`<label>${label} <input name="${k}" type="number" min="0" step="any" required /></label>`)}
        </div>
        <label class="inline"><input type="checkbox" name="staple" /> Produkt ze spiżarni (pomijany w koszyku)</label>
        <button type="submit">Dodaj produkt</button>
      </form>
      <datalist id="aisles">${[...new Set(Object.values(ctx.products).map((p) => p.aisle))].map((a) => html`<option value="${a}"></option>`)}</datalist>
    </details>`.value;

  const rowsEl = el.querySelector("#rows")!;
  const macrosEl = el.querySelector("#macros")!;
  const drawMacros = () => {
    const m = macrosOf({ ingredients: rows } as Recipe, ctx.products);
    macrosEl.textContent = `${g(m.protein)} białka · ${Math.round(m.kcal)} kcal · ${g(m.carbs)} węglowodanów · ${g(m.fat)} tłuszczu`;
  };
  const drawRows = () => {
    rowsEl.innerHTML = rows
      .map(
        (r, i) => html`<div class="ing-row" data-i="${i}">
          <select data-f="product" required><option value="">Produkt…</option>${productOptions()}</select>
          <input data-f="qty" type="number" min="0" step="any" required value="${r.qty || ""}" />
          <span class="unit">${ctx.products[r.product]?.unit ?? ""}</span>
          <button type="button" class="ghost" data-remove aria-label="Usuń">✕</button>
        </div>`.value,
      )
      .join("");
    rowsEl.querySelectorAll<HTMLElement>(".ing-row").forEach((row) => {
      const i = Number(row.dataset.i);
      const sel = row.querySelector<HTMLSelectElement>("[data-f=product]")!;
      sel.value = rows[i].product;
      sel.addEventListener("change", () => {
        rows[i].product = sel.value;
        row.querySelector(".unit")!.textContent = ctx.products[sel.value]?.unit ?? "";
        drawMacros();
      });
      row.querySelector<HTMLInputElement>("[data-f=qty]")!.addEventListener("input", (e) => {
        rows[i].qty = Number((e.target as HTMLInputElement).value);
        drawMacros();
      });
      row.querySelector("[data-remove]")!.addEventListener("click", () => {
        rows.splice(i, 1);
        drawRows();
      });
    });
    drawMacros();
  };
  drawRows();
  el.querySelector("#add-row")!.addEventListener("click", () => {
    rows.push({ product: "", qty: 0 });
    drawRows();
  });

  el.querySelector<HTMLFormElement>("#product")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const f = new FormData(form);
    const num = (k: string) => Number(f.get(k));
    const p: Product = {
      name: String(f.get("name")).trim(),
      searchTerm: String(f.get("searchTerm")).trim(),
      unit: f.get("unit") as Product["unit"],
      packSize: num("packSize"),
      aisle: String(f.get("aisle")).trim(),
      per: { kcal: num("kcal"), protein: num("protein"), carbs: num("carbs"), fat: num("fat") },
      ...(f.get("staple") ? { staple: true } : {}),
    };
    const id = `c-${slug(p.name)}`;
    await ctx.store.saveProduct(id, p);
    await ctx.reload();
    form.reset();
    rows = rows.filter((r) => r.product);
    rows.push({ product: id, qty: 0 });
    drawRows();
  });

  el.querySelector<HTMLFormElement>("#recipe")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget as HTMLFormElement);
    const error = el.querySelector("#error")!;
    const slots = f.getAll("slots") as Slot[];
    const ingredients = rows.filter((r) => r.product && r.qty > 0);
    const steps = parseSteps(String(f.get("steps")));
    if (!slots.length) return void (error.textContent = "Wybierz co najmniej jeden posiłek.");
    if (!ingredients.length) return void (error.textContent = "Dodaj co najmniej jeden składnik.");
    if (!steps.length) return void (error.textContent = "Dodaj co najmniej jeden krok.");
    const name = String(f.get("name")).trim();
    const recipe: Recipe = {
      id: src?.custom ? src.id : `c-${slug(name)}-${Date.now().toString(36)}`,
      name,
      slots,
      effort: Number(f.get("effort")) as Recipe["effort"],
      minutes: Number(f.get("minutes")),
      ingredients: ingredients.map(({ product, qty, note }) => (note ? { product, qty, note } : { product, qty })),
      steps,
    };
    await ctx.store.saveRecipe(recipe);
    await ctx.reload();
    onSaved(recipe.id);
  });
}
