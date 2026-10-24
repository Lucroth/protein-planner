// Daily reminder: emails each user whose tomorrow has empty meal slots; on Sundays also when next week is mostly unplanned.
// Usage: tsx notify.ts [--dry] [--force]   (--force skips the 18:00 Warsaw guard; --dry prints instead of sending)
import { cert, initializeApp } from "firebase-admin/app";
import { FieldPath, getFirestore } from "firebase-admin/firestore";
import nodemailer from "nodemailer";
import { SLOTS, type Day, type Slot } from "../web/src/model.ts";
import { addDays, missingSlots, mondayOf, weekDates } from "../web/src/plan.ts";

const APP_URL = "https://lucroth.github.io/protein-planner/";
const dry = process.argv.includes("--dry");
const force = process.argv.includes("--force");

const warsaw = (part: "date" | "hour" | "weekday") => {
  const opts: Intl.DateTimeFormatOptions =
    part === "date" ? { year: "numeric", month: "2-digit", day: "2-digit" } : part === "hour" ? { hour: "2-digit", hour12: false } : { weekday: "short" };
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", ...opts }).format(new Date());
};

// Two UTC crons cover summer and winter time; only the one landing on 18:00 in Warsaw sends.
if (!force && Number(warsaw("hour")) !== 18) {
  console.log(`Warsaw hour is ${warsaw("hour")}, not 18; skipping.`);
  process.exit(0);
}

initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)) });
const db = getFirestore();

const today = warsaw("date");
const tomorrow = addDays(today, 1);
const nextWeek = weekDates(addDays(mondayOf(today), 7));
const sunday = warsaw("weekday") === "Sun";
const SLOT_PL: Record<Slot, string> = { breakfast: "śniadanie", dinner: "obiad", supper: "kolacja" };

const mailer = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
});

for (const user of (await db.collection("users").get()).docs) {
  const email = user.get("email") as string | undefined;
  if (!email) continue;
  const days = user.ref.collection("days");
  const lines: string[] = [];

  const missing = missingSlots((await days.doc(tomorrow).get()).data() as Day | undefined);
  if (missing.length) lines.push(`Na jutro (${tomorrow}) brak zaplanowanych posiłków: ${missing.map((s) => SLOT_PL[s]).join(", ")}.`);

  if (sunday) {
    const snap = await days.where(FieldPath.documentId(), ">=", nextWeek[0]).where(FieldPath.documentId(), "<=", nextWeek[6]).get();
    const planned = snap.docs.reduce((n, d) => n + SLOTS.filter((s) => d.get(s)).length, 0);
    if (planned < 21 / 2) lines.push(`Na przyszły tydzień (${nextWeek[0]} – ${nextWeek[6]}) zaplanowano tylko ${planned} z 21 posiłków. Zaplanuj go i zamów zakupy.`);
  }

  if (!lines.length) {
    console.log(`${email}: all planned.`);
    continue;
  }
  const text = `${lines.join("\n\n")}\n\nZaplanuj: ${APP_URL}`;
  if (dry) console.log(`--- ${email}\n${text}`);
  else {
    await mailer.sendMail({ from: process.env.GMAIL_USER, to: email, subject: "Zaplanuj posiłki", text });
    console.log(`${email}: reminded.`);
  }
}
