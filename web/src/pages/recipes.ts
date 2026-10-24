import { sortForSlot, type Ctx } from "../ctx";
import { amount, effort, g, SLOT_LABEL } from "../format";
import { html } from "../html";
import { SLOTS, type Recipe } from "../model";

export function recipesPage(el: HTMLElement, ctx: Ctx): void {
  el.innerHTML = html`
    <div class="toolbar">
      <h1>Recipes</h1>
      <span class="spacer"></span>
      <a class="button" href="#/add">+ Add recipe</a>
    </div>
    <form class="filters" id="filters">
      <input type="search" name="q" placeholder="Search" />
      <select name="slot"><option value="">Any meal</option>${SLOTS.map((s) => html`<option value="${s}">${SLOT_LABEL[s]}</option>`)}</select>
      <select name="effort"><option value="3">Any effort</option><option value="1">Easiest only</option><option value="2">Up to medium</option></select>
      <select name="minutes"><option value="999">Any time</option><option value="10">≤ 10 min</option><option value="20">≤ 20 min</option></select>
    </form>
    <ul class="recipes" id="list"></ul>`.value;

  const form = el.querySelector<HTMLFormElement>("#filters")!;
  const list = el.querySelector("#list")!;
  const draw = () => {
    const f = new FormData(form);
    const q = String(f.get("q")).toLowerCase();
    const slot = String(f.get("slot"));
    const shown = sortForSlot(
      ctx,
      ctx.recipes.filter(
        (r) =>
          r.name.toLowerCase().includes(q) &&
          (!slot || r.slots.includes(slot as Recipe["slots"][number])) &&
          r.effort <= Number(f.get("effort")) &&
          r.minutes <= Number(f.get("minutes")),
      ),
    );
    list.innerHTML = shown.length
      ? shown.map((r) => recipeRow(ctx, r)).join("")
      : html`<li class="muted">Nothing matches.</li>`.value;
  };
  form.addEventListener("input", draw);
  draw();
}

const recipeRow = (ctx: Ctx, r: Recipe) => {
  const m = ctx.macros(r);
  return html`<li><a href="#/recipe/${r.id}" class="recipe-row">
    <span class="name">${r.name}${r.custom ? html` <span class="tag">mine</span>` : ""}</span>
    <span class="meta">${g(m.protein)} protein · ${Math.round(m.kcal)} kcal · ${r.minutes} min ${effort(r)}</span>
    <span class="meta small muted">${r.slots.map((s) => SLOT_LABEL[s]).join(" · ")}</span>
  </a></li>`.value;
};

export function recipePage(el: HTMLElement, ctx: Ctx, id: string, onDeleted: () => void): void {
  const r = ctx.byId.get(id);
  if (!r) {
    el.innerHTML = html`<h1>Recipe not found</h1><p><a href="#/recipes">All recipes</a></p>`.value;
    return;
  }
  let portions = 1;
  const draw = () => {
    const m = ctx.macros(r);
    el.innerHTML = html`
      <p class="back"><a href="#/recipes">‹ Recipes</a></p>
      <h1>${r.name}</h1>
      <p class="lead">${r.minutes} min ${effort(r)} <span class="muted small">${r.slots.map((s) => SLOT_LABEL[s]).join(" · ")}</span></p>
      <div class="macros">
        <div><strong>${g(m.protein * portions)}</strong><span>protein</span></div>
        <div><strong>${Math.round(m.kcal * portions)}</strong><span>kcal</span></div>
        <div><strong>${g(m.carbs * portions)}</strong><span>carbs</span></div>
        <div><strong>${g(m.fat * portions)}</strong><span>fat</span></div>
      </div>
      <p class="muted small">Macros estimated from typical label values.</p>
      <div class="buttons">
        <a class="button big" href="#/cook/${r.id}?x=${portions}">▶ Start cooking</a>
        <a class="button ghost" href="#/add?id=${r.id}">${r.custom ? "Edit" : "Copy & edit"}</a>
        ${r.custom ? html`<button type="button" class="ghost danger" id="delete">Delete</button>` : ""}
      </div>
      <h2>Ingredients
        <span class="stepper">
          <button type="button" class="ghost" data-k="-1" aria-label="Fewer portions">−</button>
          <span>${portions} portion${portions > 1 ? "s" : ""}</span>
          <button type="button" class="ghost" data-k="1" aria-label="More portions">+</button>
        </span>
      </h2>
      ${ingredientList(ctx, r, portions)}
      <h2>Steps</h2>
      <ol class="steps">${r.steps.map((s) => html`<li>${s.text}${s.timerSec ? html` <span class="tag">⏱ ${clock(s.timerSec)}</span>` : ""}</li>`)}</ol>`.value;

    el.querySelectorAll<HTMLButtonElement>("[data-k]").forEach((b) =>
      b.addEventListener("click", () => {
        portions = Math.max(1, Math.min(6, portions + Number(b.dataset.k)));
        draw();
      }),
    );
    el.querySelector("#delete")?.addEventListener("click", async () => {
      if (!confirm(`Delete "${r.name}"?`)) return;
      await ctx.store.deleteRecipe(r.id);
      await ctx.reload();
      onDeleted();
    });
  };
  draw();
}

export const ingredientList = (ctx: Ctx, r: Recipe, portions: number) =>
  html`<ul class="ingredients">${r.ingredients.map((i) => {
    const p = ctx.products[i.product];
    return html`<li><label><input type="checkbox" />
      <span><strong>${p ? amount(i, p, portions) : i.qty}</strong> ${p?.name ?? i.product}${i.note ? html` <span class="muted small">(${i.note})</span>` : ""}</span>
    </label></li>`;
  })}</ul>`;

export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
