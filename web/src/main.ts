import "./style.css";
import { createCtx, type Ctx } from "./ctx";
import { html } from "./html";
import { addPage } from "./pages/add";
import { cookPage } from "./pages/cook";
import { recipePage, recipesPage } from "./pages/recipes";
import { shopPage } from "./pages/shop";
import { weekPage } from "./pages/week";
import { mondayOf, today } from "./plan";
import { firebaseConfigured, localStore } from "./store";

const app = document.getElementById("app")!;
const nav = document.getElementById("nav")!;

let ctx: Ctx | undefined;
let cleanup: (() => void) | void;

function renderNav(user?: { name: string; signOut: () => void }): void {
  nav.innerHTML = html`
    <a href="#/week">Tydzień</a>
    <a href="#/recipes">Przepisy</a>
    <a href="#/shop">Zakupy</a>
    ${user ? html`<button type="button" class="link small" id="logout" title="${user.name}">Wyloguj</button>` : ""}`.value;
  if (user) document.getElementById("logout")!.addEventListener("click", user.signOut);
}

/** Hash routes, so GitHub Pages never has to know about them: #/week/2026-10-26, #/recipe/skyr-bowl, #/cook/skyr-bowl?x=2. */
async function route(): Promise<void> {
  if (!ctx) return;
  cleanup?.();
  cleanup = undefined;
  const [path, search = ""] = location.hash.replace(/^#/, "").split("?");
  const params = new URLSearchParams(search);
  const [page, arg] = path.split("/").filter(Boolean);
  document.body.classList.toggle("cooking", page === "cook");
  nav.querySelectorAll("a").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === `#/${page ?? "week"}`));
  try {
    if (page === "recipes") recipesPage(app, ctx);
    else if (page === "recipe" && arg) recipePage(app, ctx, arg, () => (location.hash = "#/recipes"));
    else if (page === "cook" && arg) cleanup = cookPage(app, ctx, arg, Number(params.get("x")) || 1);
    else if (page === "shop") await shopPage(app, ctx, params);
    else if (page === "add") addPage(app, ctx, params.get("id"), (id) => (location.hash = `#/recipe/${id}`));
    else await weekPage(app, ctx, mondayOf(arg && /^\d{4}-\d{2}-\d{2}$/.test(arg) ? arg : today()));
    if (page !== "cook") window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    app.innerHTML = html`<h1>Coś poszło nie tak</h1><p class="muted">${(e as Error).message}</p><p><a href="#/week">Wróć do tygodnia</a></p>`.value;
  }
}

window.addEventListener("hashchange", route);

if (firebaseConfigured) {
  const fb = await import("./firebase");
  fb.onUser(async (user) => {
    if (!user) {
      ctx = undefined;
      renderNav();
      app.innerHTML = html`<div class="signin"><h1>Planer białkowy</h1><p class="muted">Trzy wysokobiałkowe posiłki dziennie, 140 g białka.</p>
        <button type="button" class="big" id="signin">Zaloguj przez Google</button></div>`.value;
      document.getElementById("signin")!.addEventListener("click", () => void fb.signIn().catch((e) => alert(e.message)));
      return;
    }
    renderNav({ name: user.email ?? "", signOut: () => void fb.logOut() });
    ctx = await createCtx(fb.firestoreStore(user.uid));
    await route();
  });
} else {
  renderNav();
  ctx = await createCtx(localStore());
  await route();
}

if ("serviceWorker" in navigator && import.meta.env.PROD) void navigator.serviceWorker.register("./sw.js");
