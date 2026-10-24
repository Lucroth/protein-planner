import type { Ctx } from "../ctx";
import { html } from "../html";
import { clock, ingredientList } from "./recipes";

interface Timer {
  step: number;
  total: number;
  /** Set while running; `left` holds the remainder while paused. */
  endsAt?: number;
  left: number;
  rang?: boolean;
}

/** One step per screen, timers that keep running across steps, and the screen kept awake. Returns a cleanup. */
export function cookPage(el: HTMLElement, ctx: Ctx, id: string, portions: number): () => void {
  const r = ctx.byId.get(id);
  if (!r) {
    el.innerHTML = html`<h1>Recipe not found</h1>`.value;
    return () => {};
  }
  let step = 0;
  const timers = new Map<number, Timer>();
  const remaining = (t: Timer) => Math.max(0, t.endsAt ? (t.endsAt - Date.now()) / 1000 : t.left);

  let lock: WakeLockSentinel | undefined;
  const wake = async () => {
    try {
      if (document.visibilityState === "visible") lock = await navigator.wakeLock?.request("screen");
    } catch {
      // Not supported or denied (battery saver): cooking still works, the screen may dim.
    }
  };
  void wake();
  document.addEventListener("visibilitychange", wake);

  const draw = () => {
    const s = r.steps[step];
    const t = timers.get(step);
    const last = step === r.steps.length - 1;
    el.innerHTML = html`
      <div class="cook">
        <header class="cook-head">
          <a href="#/recipe/${r.id}" class="small">✕ ${r.name}</a>
          <span class="small muted">Step ${step + 1} / ${r.steps.length}</span>
        </header>
        <div class="progress"><span style="width:${((step + 1) / r.steps.length) * 100}%"></span></div>
        <div id="others" class="others"></div>
        <p class="step-text">${s.text}</p>
        ${s.timerSec
          ? html`<div class="timer">
              <span id="time" class="time">${clock(t ? remaining(t) : s.timerSec)}</span>
              <div class="buttons">
                <button type="button" id="toggle">${t?.endsAt ? "Pause" : t ? "Resume" : "Start timer"}</button>
                ${t ? html`<button type="button" class="ghost" id="reset">Reset</button>` : ""}
              </div>
            </div>`
          : ""}
        <nav class="cook-nav">
          <button type="button" class="ghost big" id="prev" ${step === 0 ? "disabled" : ""}>‹ Back</button>
          ${last ? html`<a class="button big" href="#/recipe/${r.id}">Done ✓</a>` : html`<button type="button" class="big" id="next">Next ›</button>`}
        </nav>
        <details class="drawer"><summary>Ingredients${portions > 1 ? ` (×${portions})` : ""}</summary>${ingredientList(ctx, r, portions)}</details>
      </div>`.value;

    el.querySelector("#prev")?.addEventListener("click", () => go(-1));
    el.querySelector("#next")?.addEventListener("click", () => go(1));
    el.querySelector("#toggle")?.addEventListener("click", () => {
      const cur = timers.get(step) ?? { step, total: s.timerSec!, left: s.timerSec! };
      if (cur.endsAt) {
        cur.left = remaining(cur);
        cur.endsAt = undefined;
      } else {
        cur.endsAt = Date.now() + cur.left * 1000;
        unlockAudio();
      }
      timers.set(step, cur);
      draw();
    });
    el.querySelector("#reset")?.addEventListener("click", () => {
      timers.delete(step);
      draw();
    });
    tick();
  };

  const go = (d: number) => {
    step = Math.max(0, Math.min(r.steps.length - 1, step + d));
    draw();
  };

  const tick = () => {
    const t = timers.get(step);
    const time = el.querySelector("#time");
    if (t && time) time.textContent = clock(remaining(t));
    const others = el.querySelector("#others");
    if (others)
      others.innerHTML = [...timers.values()]
        .filter((o) => o.step !== step)
        .map((o) => html`<button type="button" class="chip ${remaining(o) === 0 ? "done" : ""}" data-step="${o.step}">Step ${o.step + 1} ⏱ ${clock(remaining(o))}</button>`.value)
        .join("");
    others?.querySelectorAll<HTMLButtonElement>("[data-step]").forEach((b) => (b.onclick = () => ((step = Number(b.dataset.step)), draw())));
    for (const o of timers.values())
      if (o.endsAt && remaining(o) === 0 && !o.rang) {
        o.rang = true;
        ring();
      }
  };
  const interval = setInterval(tick, 250);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") go(1);
    if (e.key === "ArrowLeft") go(-1);
  };
  document.addEventListener("keydown", onKey);

  let startX: number | undefined;
  const down = (e: PointerEvent) => (startX = e.clientX);
  const up = (e: PointerEvent) => {
    if (startX === undefined || (e.target as HTMLElement).closest("button, a, details")) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
    startX = undefined;
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointerup", up);

  draw();
  return () => {
    clearInterval(interval);
    document.removeEventListener("visibilitychange", wake);
    document.removeEventListener("keydown", onKey);
    el.removeEventListener("pointerdown", down);
    el.removeEventListener("pointerup", up);
    void lock?.release();
  };
}

let audio: AudioContext | undefined;
// Browsers only allow sound after a user gesture, so the context is created on "Start timer".
const unlockAudio = () => {
  audio ??= new AudioContext();
  void audio.resume();
};

function ring(): void {
  navigator.vibrate?.([300, 150, 300, 150, 300]);
  if (!audio) return;
  for (let i = 0; i < 3; i++) {
    const o = audio.createOscillator();
    const gain = audio.createGain();
    o.frequency.value = 880;
    o.connect(gain).connect(audio.destination);
    const t = audio.currentTime + i * 0.4;
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.start(t);
    o.stop(t + 0.3);
  }
}
