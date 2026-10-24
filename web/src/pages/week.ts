import { sortForSlot, type Ctx } from "../ctx";
import { dayLabel, effort, g, SLOT_LABEL } from "../format";
import { html } from "../html";
import { addMacros, PROTEIN_TARGET, SLOTS, ZERO, type Day, type Slot } from "../model";
import { addDays, autoFill, missingSlots, mondayOf, today, weekDates } from "../plan";

export async function weekPage(el: HTMLElement, ctx: Ctx, monday: string): Promise<void> {
  const dates = weekDates(monday);
  const tomorrow = addDays(today(), 1);
  const days = await ctx.store.days(dates[0], dates[6] > tomorrow ? dates[6] : tomorrow);
  const tomorrowDay = days[tomorrow] ?? (await ctx.store.days(tomorrow, tomorrow))[tomorrow];

  const render = () => {
    const missing = missingSlots(tomorrowDay);
    el.innerHTML = html`
      ${missing.length
        ? html`<p class="banner">Jutro (${dayLabel(tomorrow)}) brak zaplanowanych posiłków: ${missing.map((s) => SLOT_LABEL[s].toLowerCase()).join(", ")}.
            ${dates.includes(tomorrow) ? "" : html`<a href="#/week/${mondayOf(tomorrow)}">Przejdź do tego tygodnia</a>`}</p>`
        : ""}
      <div class="toolbar">
        <a class="button ghost" href="#/week/${addDays(monday, -7)}" aria-label="Poprzedni tydzień">‹</a>
        <h1>${dayLabel(dates[0], { day: "numeric", month: "short" })} – ${dayLabel(dates[6], { day: "numeric", month: "short" })}</h1>
        <a class="button ghost" href="#/week/${addDays(monday, 7)}" aria-label="Następny tydzień">›</a>
        <span class="spacer"></span>
        <button type="button" id="autofill">Uzupełnij puste posiłki</button>
        <a class="button ghost" href="#/shop?from=${dates[0]}&to=${dates[6]}">Lista zakupów</a>
      </div>
      <div class="week">
        ${dates.map((d) => dayCard(ctx, d, days[d], d === today()))}
      </div>
      <dialog id="picker"></dialog>`.value;

    el.querySelector("#autofill")!.addEventListener("click", async () => {
      await ctx.store.saveDays(autoFill(days, dates, ctx.recipes, ctx.products));
      await weekPage(el, ctx, monday);
    });
    el.querySelectorAll<HTMLButtonElement>("[data-slot]").forEach((b) =>
      b.addEventListener("click", () => pick(b.dataset.date!, b.dataset.slot as Slot)),
    );
  };

  const pick = (date: string, slot: Slot) => {
    const dialog = el.querySelector<HTMLDialogElement>("#picker")!;
    const current = days[date]?.[slot];
    const list = sortForSlot(ctx, ctx.recipes.filter((r) => r.slots.includes(slot)));
    dialog.innerHTML = html`
      <form method="dialog" class="picker">
        <header><strong>${SLOT_LABEL[slot]} · ${dayLabel(date)}</strong><button value="" class="ghost">Zamknij</button></header>
        <ul>
          ${list.map(
            (r) => html`<li class="${r.id === current ? "on" : ""}">
              <button value="${r.id}" class="pick">
                <span class="name">${r.name}</span>
                <span class="meta">${g(ctx.macros(r).protein)} białka · ${r.minutes} min ${effort(r)}</span>
              </button>
              <a href="#/recipe/${r.id}" class="small">zobacz</a>
            </li>`,
          )}
        </ul>
        ${current ? html`<button value="-" class="ghost danger">Wyczyść posiłek</button>` : ""}
      </form>`.value;
    dialog.onclose = async () => {
      const v = dialog.returnValue;
      if (!v) return;
      const day: Day = { ...days[date] };
      if (v === "-") delete day[slot];
      else day[slot] = v;
      days[date] = day;
      await ctx.store.saveDays({ [date]: day });
      if (date === tomorrow) await weekPage(el, ctx, monday);
      else render();
    };
    dialog.returnValue = "";
    dialog.showModal();
  };

  render();
}

function dayCard(ctx: Ctx, date: string, day: Day | undefined, isToday: boolean) {
  const total = SLOTS.reduce((m, s) => {
    const r = day?.[s] && ctx.byId.get(day[s]!);
    return r ? addMacros(m, ctx.macros(r)) : m;
  }, ZERO);
  const pct = Math.min(100, (total.protein / PROTEIN_TARGET) * 100);
  const status = Math.abs(total.protein - PROTEIN_TARGET) <= 10 ? "ok" : total.protein > PROTEIN_TARGET ? "over" : "under";
  return html`<section class="day ${isToday ? "today" : ""}">
    <header>
      <strong>${dayLabel(date)}</strong>
      <span class="small muted">${Math.round(total.kcal)} kcal</span>
    </header>
    <div class="bar ${status}" title="${g(total.protein)} z ${PROTEIN_TARGET} g białka"><span style="width:${pct}%"></span></div>
    <p class="small protein">${g(total.protein)} / ${PROTEIN_TARGET} g białka</p>
    ${SLOTS.map((s) => {
      const r = day?.[s] && ctx.byId.get(day[s]!);
      return html`<div class="slot">
        <span class="label">${SLOT_LABEL[s]}</span>
        <button type="button" class="slot-btn ${r ? "" : "empty"}" data-date="${date}" data-slot="${s}">
          ${r ? html`<span class="name">${r.name}</span><span class="meta">${g(ctx.macros(r).protein)} · ${r.minutes} min ${effort(r)}</span>` : "+ wybierz"}
        </button>
        ${r ? html`<a class="cook-link" href="#/cook/${r.id}" title="Gotuj">▶</a>` : ""}
      </div>`;
    })}
  </section>`;
}
