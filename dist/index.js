// Reminders stay in this phone's records, the contact never hears of them and nothing leaves the frame.

import { t } from "./i18n.js";

export const PREFIX = "reminder/";

export function reminderKey(id) {
  return `${PREFIX}${id}`;
}

/** The same id names the record and the core's reminder, so a tapped notification finds it. */
export function newId(now = Date.now()) {
  const random = Math.floor(Math.random() * 36 ** 6).toString(36).padStart(6, "0");
  return `${now.toString(36).padStart(9, "0")}${random}`;
}

export function reminderFrom(text, ref, at, now = Date.now()) {
  const reminder = { id: newId(now), text: String(text ?? ""), at, createdAt: now };
  if (ref) reminder.ref = String(ref);
  return reminder;
}

export function parseReminder(json) {
  let read;
  try {
    read = JSON.parse(json);
  } catch {
    return null;
  }
  const number = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  if (!read || typeof read !== "object" || typeof read.id !== "string" || !read.id) return null;
  if (typeof read.text !== "string" || number(read.at) === null) return null;
  const reminder = { id: read.id, text: read.text, at: read.at, createdAt: number(read.createdAt) ?? 0 };
  if (typeof read.ref === "string" && read.ref) reminder.ref = read.ref;
  return reminder;
}

export function titleOf(text, limit = 200) {
  const line = String(text ?? "")
    .split("\n")
    .map((one) => one.trim())
    .find((one) => one.length > 0);
  if (!line) return "";
  return line.length > limit ? `${line.slice(0, limit - 1)}…` : line;
}

// the lock screen gets the message's first line only if the user allows it
export function notificationText(reminder, showText) {
  return showText ? titleOf(reminder.text) : "";
}

export function stateOf(reminder, now = Date.now()) {
  return reminder.at > now ? "pending" : "past";
}

export function sortReminders(reminders, now = Date.now()) {
  const pending = reminders.filter((one) => stateOf(one, now) === "pending").sort((a, b) => a.at - b.at);
  const past = reminders.filter((one) => stateOf(one, now) === "past").sort((a, b) => b.at - a.at);
  return [...pending, ...past];
}

const EVENING_MARGIN = 30 * 60 * 1000;

export function presets(now = Date.now()) {
  const hour = new Date(now + 60 * 60 * 1000);
  hour.setSeconds(0, 0);
  const evening = new Date(now);
  evening.setHours(19, 0, 0, 0);
  const morning = new Date(now);
  morning.setDate(morning.getDate() + 1);
  morning.setHours(9, 0, 0, 0);
  const moments = [{ key: "hour", at: hour.getTime() }];
  if (evening.getTime() - now > EVENING_MARGIN) moments.push({ key: "evening", at: evening.getTime() });
  moments.push({ key: "morning", at: morning.getTime() });
  return moments;
}

export function whenLabel(at, now = Date.now(), lang = "en") {
  const day = new Date(at);
  const today = new Date(now);
  const sameDay = day.getFullYear() === today.getFullYear() && day.getMonth() === today.getMonth() && day.getDate() === today.getDate();
  const options = sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
  if (!sameDay && day.getFullYear() !== today.getFullYear()) options.year = "numeric";
  try {
    return new Intl.DateTimeFormat(lang, options).format(day);
  } catch {
    return new Intl.DateTimeFormat("en", options).format(day);
  }
}

export function toIso(at) {
  const day = new Date(at);
  const two = (value) => String(value).padStart(2, "0");
  return `${day.getFullYear()}-${two(day.getMonth() + 1)}-${two(day.getDate())}T${two(day.getHours())}:${two(day.getMinutes())}`;
}

// parsed by hand, Date would read a date alone as UTC
export function fromIso(value) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(typeof value === "string" ? value : "");
  if (!parts) return null;
  const [year, month, day, hour, minute, second] = parts.slice(1).map((part) => Number(part ?? 0));
  const moment = new Date(year, month - 1, day, hour, minute, second);
  // a month or day that doesn't exist would roll over into another one
  if (moment.getMonth() !== month - 1 || moment.getDate() !== day) return null;
  return moment.getTime();
}

const escape = (text) =>
  String(text).replace(/[&<>"']/g, (one) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[one]);

const STYLE = `
ft-remind { display: flex; flex-direction: column; height: 100%; font: 15px system-ui, sans-serif; color: var(--ion-text-color, #111); --soft: var(--ion-color-medium, #666); --accent: var(--ion-color-danger, #e0562b); --mark: var(--ion-color-primary, #3880ff); --surface: var(--ion-item-background, rgba(127, 127, 127, .08)); }
@media (prefers-color-scheme: dark) { ft-remind { color: var(--ion-text-color, #f4f4f4); --soft: var(--ion-color-medium, #aaa); } }
[data-dark] ft-remind { color: var(--ion-text-color, #f4f4f4); --soft: var(--ion-color-medium, #aaa); }
ft-remind * { box-sizing: border-box; }
ft-remind ion-content { flex: 1; }
ft-remind .view { padding: 8px 12px 24px; }
ft-remind .i {
  display: block; width: 22px; height: 22px; margin: auto; background: currentColor;
  -webkit-mask: var(--i) center/contain no-repeat; mask: var(--i) center/contain no-repeat;
}
ft-remind ion-button .i[slot="start"] { margin-inline-end: 6px; }
ft-remind ion-button .i[slot="end"] { margin-inline-start: 6px; }
ft-remind .quote {
  margin: 8px 0 16px; padding: 10px 12px; border-inline-start: 3px solid var(--mark); border-radius: 8px;
  background: var(--surface); white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.4;
}
ft-remind .quote.cut { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 6; overflow: hidden; }
ft-remind .choices ion-button { margin: 8px 0; }
ft-remind ion-button .at { opacity: .7; margin-inline-start: 8px; font-weight: normal; }
ft-remind ion-datetime { margin: 8px auto; }
ft-remind .empty { color: var(--soft); text-align: center; padding: 48px 16px; }
ft-remind .empty .i, ft-remind .empty ion-icon { width: 48px; height: 48px; font-size: 48px; margin: 0 auto 12px; display: block; }
ft-remind .warn { color: var(--accent); margin: 8px 0; }
ft-remind .hint { color: var(--soft); font-size: 13px; margin: 8px 0; }
ft-remind .when { display: flex; align-items: center; gap: 8px; font-weight: 600; margin: 8px 0 0; }
ft-remind .when .i, ft-remind .when ion-icon { margin: 0; font-size: 22px; flex: none; }
ft-remind .mark { color: var(--soft); font-weight: normal; }
ft-remind .section { color: var(--soft); font-size: 13px; margin: 20px 0 0; }
ft-remind ion-item.past { opacity: .75; }
ft-remind ion-item .i[slot="start"] { margin: 0; margin-inline-end: 16px; }
ft-remind ion-item .i[slot="end"] { margin: 0; margin-inline-start: 12px; width: 18px; height: 18px; }
`;

const icon = (name, slot = "icon-only", label = "") => {
  const where = slot ? ` slot="${slot}"` : "";
  const says = label ? `role="img" aria-label="${escape(label)}"` : 'aria-hidden="true"';
  return globalThis.Ionicons?.map?.has(name)
    ? `<ion-icon${where} name="${name}" ${says}></ion-icon>`
    : `<i${where} class="i" style="--i:url(./icon/${name}.svg)" ${says}></i>`;
};
const button = (act, label, name, extra = "") =>
  `<ion-button ${/\bfill=/.test(extra) ? "" : 'fill="clear"'} data-act="${act}" aria-label="${escape(label)}" ${extra}>${icon(name)}</ion-button>`;

const PRESET_ICONS = { hour: "timer-outline", evening: "time-outline", morning: "alarm-outline" };

class Reminders extends HTMLElement {
  constructor() {
    super();
    this.language = "en";
    this.reminders = [];
    this.screen = "list";
    this.draft = null;
    this.current = null;
    this.chatGone = false;
    this.picking = false;
    this.picked = null;
    this.showText = false;
    this.warning = "";
    this.acting = false;
  }

  connectedCallback() {
    // no shadow root, Ionic's global styles don't cross it
    this.addEventListener("click", (event) => this.onClick(event));
    this.addEventListener("ionChange", (event) => this.onChange(event));
    globalThis.ft?.onOpen?.((opening) => this.onOpen(opening));
    this.paint();
  }

  async onOpen(opening) {
    this.language = opening.lang || "en";
    this.showText = (await globalThis.ft.store.get("showText")) === "1";
    await this.load();
    if (opening.reminder) {
      const reminder = this.reminders.find((one) => one.id === opening.reminder);
      if (reminder) return this.detail(reminder);
    }
    if (opening.text) {
      this.draft = { text: String(opening.text), ref: opening.ref || null };
      return this.show("new");
    }
    this.show("list");
  }

  async load() {
    const keys = await globalThis.ft.records.keys(PREFIX);
    const reminders = [];
    for (const key of keys) {
      const reminder = parseReminder(await globalThis.ft.records.get(key));
      if (reminder) reminders.push(reminder);
    }
    this.reminders = reminders;
  }

  say(key, values) {
    return t(this.language, key, values);
  }

  detail(reminder) {
    this.current = { ...reminder };
    this.chatGone = false;
    this.show("detail");
  }

  show(screen) {
    this.screen = screen;
    this.picking = false;
    this.picked = null;
    this.warning = "";
    this.paint();
  }

  async onClick(event) {
    const target = event.target.closest?.("[data-act]");
    if (!target || !this.contains(target) || this.acting) return;
    this.acting = true;
    try {
      await this.act(target);
    } finally {
      this.acting = false;
    }
  }

  async act(target) {
    const { act, key } = target.dataset;
    if (act === "preset") {
      const moment = presets().find((one) => one.key === key);
      if (moment) await this.choose(moment.at);
      else this.paint();
    } else if (act === "pick") {
      this.picking = true;
      this.paint();
    } else if (act === "setPicked") {
      this.picked = this.querySelector("ion-datetime")?.value ?? this.picked;
      await this.choose(fromIso(this.picked));
    } else if (act === "open") {
      const reminder = this.reminders.find((one) => one.id === target.dataset.id);
      if (reminder) this.detail(reminder);
    } else if (act === "chat") {
      if (!(await globalThis.ft.openChat(this.current.ref))) {
        this.chatGone = true;
        this.paint();
      }
    } else if (act === "delete") await this.erase();
    else if (act === "settings") this.show("settings");
    else if (act === "back") {
      this.draft = null;
      this.current = null;
      this.show("list");
    }
  }

  async onChange(event) {
    if (event.target.getAttribute?.("name") !== "showText") return;
    this.showText = Boolean(event.detail?.checked ?? event.target.checked);
    await globalThis.ft.store.set("showText", this.showText ? "1" : "0");
    for (const reminder of this.reminders) {
      if (stateOf(reminder) === "pending") await this.schedule(reminder);
    }
  }

  async choose(at) {
    if (at === null || at <= Date.now()) {
      this.warning = this.say("future");
      return this.paint();
    }
    if (this.screen === "detail") return this.move(at);
    const reminder = reminderFrom(this.draft.text, this.draft.ref, at);
    if (!(await this.commit(reminder))) return this.paint();
    this.reminders.push(reminder);
    this.draft = null;
    this.announce(at);
    this.show("list");
  }

  async move(at) {
    const previous = this.current;
    const reminder = { ...previous, at };
    if (!(await this.commit(reminder, previous))) return this.paint();
    this.reminders = this.reminders.map((one) => (one.id === reminder.id ? reminder : one));
    this.announce(at);
    this.detail(reminder);
  }

  async commit(reminder, previous = null) {
    if (!(await this.schedule(reminder))) {
      this.warning = this.say("noRemind");
      return false;
    }
    if (await globalThis.ft.records.set(reminderKey(reminder.id), JSON.stringify(reminder))) return true;
    this.warning = this.say("full");
    if (previous && stateOf(previous) === "pending") await this.schedule(previous);
    else await globalThis.ft.remind.cancel(reminder.id);
    return false;
  }

  schedule(reminder) {
    return globalThis.ft.remind.set(reminder.id, reminder.at, notificationText(reminder, this.showText));
  }

  async erase() {
    const reminder = this.current;
    if (!reminder || !(await this.sure())) return;
    await globalThis.ft.remind.cancel(reminder.id);
    await globalThis.ft.records.forget(reminderKey(reminder.id));
    this.reminders = this.reminders.filter((one) => one.id !== reminder.id);
    this.current = null;
    this.show("list");
  }

  // the frame has no browser dialogs
  async sure() {
    const alerts = globalThis.ftIonic?.alertController;
    if (!alerts) return false;
    const alert = await alerts.create({
      message: this.say("confirmDelete"),
      buttons: [
        { text: this.say("back"), role: "cancel" },
        { text: this.say("delete"), role: "destructive" },
      ],
    });
    await alert.present();
    return (await alert.onDidDismiss()).role === "destructive";
  }

  // ft.notify is missing before app 1.4.1
  announce(at) {
    if (typeof globalThis.ft.notify === "function") globalThis.ft.notify(this.say("setFor", { when: whenLabel(at, Date.now(), this.language) }));
  }

  paint() {
    if (this.screen === "new") this.paintNew();
    else if (this.screen === "detail") this.paintDetail();
    else if (this.screen === "settings") this.paintSettings();
    else this.paintList();
  }

  frame(start, end, body) {
    this.innerHTML = `<style>${STYLE}</style>
      <ion-header><ion-toolbar>
        <ion-buttons slot="start">${start}</ion-buttons>
        <ion-buttons slot="end">${end}</ion-buttons>
      </ion-toolbar></ion-header>
      <ion-content><div class="view">${body}</div></ion-content>`;
  }

  choices() {
    const now = Date.now();
    const time = (at) => whenLabel(at, at, this.language);
    const offered = presets(now)
      .map(({ key, at }) => `<ion-button expand="block" fill="outline" data-act="preset" data-key="${key}">${icon(PRESET_ICONS[key], "start")}${escape(this.say(key))}<span class="at">${escape(time(at))}</span></ion-button>`)
      .join("");
    const picker = this.picking
      ? `<ion-datetime presentation="date-time" min="${toIso(now)}" value="${escape(this.picked ?? toIso(presets(now)[0].at))}" locale="${escape(this.language)}" aria-label="${escape(this.say("pick"))}"></ion-datetime>
         <ion-button expand="block" data-act="setPicked">${icon("checkmark-outline", "start")}${escape(this.say("set"))}</ion-button>`
      : `<ion-button expand="block" fill="outline" data-act="pick">${icon("calendar-outline", "start")}${escape(this.say("pick"))}</ion-button>`;
    const warning = this.warning ? `<p class="warn" role="alert">${escape(this.warning)}</p>` : "";
    return `<div class="choices">${offered}${picker}</div>${warning}`;
  }

  paintNew() {
    this.frame(
      button("back", this.say("back"), "arrow-back-outline"),
      "",
      `<blockquote class="quote cut" dir="auto">${escape(this.draft.text)}</blockquote>${this.choices()}`,
    );
  }

  when(reminder, now) {
    const past = stateOf(reminder, now) === "past";
    const mark = past ? ` <span class="mark">· ${escape(this.say("past"))}</span>` : "";
    return `${escape(whenLabel(reminder.at, now, this.language))}${mark}`;
  }

  paintDetail() {
    const now = Date.now();
    const reminder = this.current;
    const state = stateOf(reminder, now);
    const chat = !reminder.ref
      ? ""
      : this.chatGone
        ? `<p class="hint">${escape(this.say("chatGone"))}</p>`
        : `<ion-button expand="block" fill="outline" data-act="chat">${icon("chatbubble-outline", "start")}${escape(this.say("goToChat"))}</ion-button>`;
    this.frame(
      button("back", this.say("back"), "arrow-back-outline"),
      button("delete", this.say("delete"), "trash-outline", 'color="danger"'),
      `<p class="when ${state}">${icon(state === "pending" ? "alarm-outline" : "time-outline", "")}<span>${this.when(reminder, now)}</span></p>
       <blockquote class="quote" dir="auto">${escape(reminder.text)}</blockquote>
       ${chat}
       <p class="section">${escape(this.say(state === "pending" ? "move" : "again"))}</p>
       ${this.choices()}`,
    );
  }

  paintSettings() {
    this.frame(
      button("back", this.say("back"), "arrow-back-outline"),
      "",
      `<ion-toggle name="showText" justify="space-between" ${this.showText ? "checked" : ""}>${escape(this.say("showText"))}</ion-toggle>
       <p class="hint">${escape(this.say("showTextHint"))}</p>`,
    );
  }

  paintList() {
    const now = Date.now();
    const rows = sortReminders(this.reminders, now)
      .map((one) => {
        const state = stateOf(one, now);
        return `<ion-item button detail="false" data-act="open" data-id="${escape(one.id)}" class="${state}">
          ${icon(state === "pending" ? "alarm-outline" : "time-outline", "start")}
          <ion-label><h2>${this.when(one, now)}</h2><p dir="auto">${escape(titleOf(one.text, 120))}</p></ion-label>
          ${one.ref ? icon("chatbubble-outline", "end", this.say("fromChat")) : ""}
        </ion-item>`;
      })
      .join("");
    const body = rows ? `<ion-list>${rows}</ion-list>` : `<div class="empty">${icon("alarm-outline", "")}<p>${escape(this.say("empty"))}</p></div>`;
    this.frame("", button("settings", this.say("settings"), "options-outline"), body);
  }
}

if (!customElements.get("ft-remind")) customElements.define("ft-remind", Reminders);
