import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PREFIX,
  fromIso,
  newId,
  notificationText,
  parseReminder,
  presets,
  reminderFrom,
  reminderKey,
  sortReminders,
  stateOf,
  titleOf,
  toIso,
  whenLabel,
} from "./dist/index.js";
import { LANGUAGES, catalogueOf, t } from "./dist/i18n.js";

const HERE = import.meta.dirname;
const manifest = JSON.parse(readFileSync(join(HERE, "module.json"), "utf8"));

const NOW = new Date(2026, 9, 13, 10, 0, 0).getTime();
const at = (...parts) => new Date(...parts).getTime();

describe("a reminder", () => {
  it("is born from a message the user handed over, with the way back to its conversation", () => {
    const reminder = reminderFrom("Call the bank", "ref_1", NOW + 3_600_000, NOW);
    expect(reminder).toEqual({ id: reminder.id, text: "Call the bank", ref: "ref_1", at: NOW + 3_600_000, createdAt: NOW });
    expect(reminder.id).toMatch(/^[0-9a-z]+$/);
    expect(reminderFrom("x", null, NOW, NOW)).not.toHaveProperty("ref");
    expect(reminderFrom("x", "", NOW, NOW)).not.toHaveProperty("ref");
    expect(reminderKey(reminder.id)).toBe(`${PREFIX}${reminder.id}`);
    expect(PREFIX).toBe("reminder/");
  });

  it("gets ids that list in the order they were made and never repeat", () => {
    expect(newId(NOW) < newId(NOW + 1)).toBe(true);
    const ids = new Set(Array.from({ length: 200 }, () => newId(NOW)));
    expect(ids.size).toBe(200);
  });

  it("reads back from its record and rejects what is not a reminder", () => {
    const reminder = { id: "a", text: "x", ref: "ref_a", at: 3, createdAt: 1 };
    expect(parseReminder(JSON.stringify(reminder))).toEqual(reminder);
    expect(parseReminder(JSON.stringify({ id: "a", text: "x", at: 3 }))).toEqual({ id: "a", text: "x", at: 3, createdAt: 0 });
    expect(parseReminder("not json")).toBeNull();
    expect(parseReminder(null)).toBeNull();
    expect(parseReminder(JSON.stringify({ id: 1, text: "x", at: 3 }))).toBeNull();
    expect(parseReminder(JSON.stringify({ id: "", text: "x", at: 3 }))).toBeNull();
    expect(parseReminder(JSON.stringify({ id: "a", text: "x", at: "soon" }))).toBeNull();
    expect(parseReminder(JSON.stringify({ id: "a", text: "x" }))).toBeNull();
    expect(parseReminder(JSON.stringify({ id: "a", text: "x", at: 3, ref: "" }))).not.toHaveProperty("ref");
  });

  it("is titled by the message's first line, cut short", () => {
    expect(titleOf("\n\n  Milk  \nand eggs")).toBe("Milk");
    expect(titleOf("")).toBe("");
    expect(titleOf(null)).toBe("");
    expect(titleOf("a".repeat(300))).toHaveLength(200);
    expect(titleOf("a".repeat(300)).endsWith("…")).toBe(true);
    expect(titleOf("a".repeat(300), 80)).toHaveLength(80);
  });

  it("only says the message on the lock screen when the user allows it", () => {
    const reminder = { text: "Call the dentist\nat 5" };
    expect(notificationText(reminder, true)).toBe("Call the dentist");
    expect(notificationText(reminder, false)).toBe("");
    expect(notificationText({ text: "a".repeat(500) }, true)).toHaveLength(200);
  });

  it("is still to come, or past", () => {
    expect(stateOf({ at: NOW + 1 }, NOW)).toBe("pending");
    expect(stateOf({ at: NOW }, NOW)).toBe("past");
    expect(stateOf({ at: NOW - 1 }, NOW)).toBe("past");
  });
});

describe("the list", () => {
  it("puts the reminders still to come first, the soonest first, then the past ones, the latest first", () => {
    const reminders = [
      { id: "long-ago", at: NOW - 90_000 },
      { id: "later", at: NOW + 5000 },
      { id: "just-now", at: NOW - 1000 },
      { id: "soon", at: NOW + 1000 },
    ];
    expect(sortReminders(reminders, NOW).map((one) => one.id)).toEqual(["soon", "later", "just-now", "long-ago"]);
    expect(reminders.map((one) => one.id)).toEqual(["long-ago", "later", "just-now", "soon"]);
  });
});

describe("the moments on offer", () => {
  const keys = (now) => presets(now).map((one) => one.key);
  const moment = (now, key) => presets(now).find((one) => one.key === key)?.at;

  it("are an hour from now, this evening at 19:00 and tomorrow morning at 09:00", () => {
    expect(keys(NOW)).toEqual(["hour", "evening", "morning"]);
    expect(moment(NOW, "hour")).toBe(at(2026, 9, 13, 11, 0));
    expect(moment(NOW, "evening")).toBe(at(2026, 9, 13, 19, 0));
    expect(moment(NOW, "morning")).toBe(at(2026, 9, 14, 9, 0));
  });

  it("count the hour to the minute", () => {
    expect(moment(at(2026, 9, 13, 10, 12, 45, 300), "hour")).toBe(at(2026, 9, 13, 11, 12));
  });

  it("leave this evening out once it is half an hour away or less", () => {
    expect(keys(at(2026, 9, 13, 18, 20))).toEqual(["hour", "evening", "morning"]);
    expect(keys(at(2026, 9, 13, 18, 30))).toEqual(["hour", "morning"]);
    expect(keys(at(2026, 9, 13, 18, 45))).toEqual(["hour", "morning"]);
    expect(keys(at(2026, 9, 13, 22, 0))).toEqual(["hour", "morning"]);
  });

  it("make tomorrow the next day, across the end of the month", () => {
    expect(moment(at(2026, 9, 31, 23, 0), "morning")).toBe(at(2026, 10, 1, 9, 0));
    expect(moment(at(2026, 9, 31, 23, 30), "hour")).toBe(at(2026, 10, 1, 0, 30));
  });
});

describe("a moment", () => {
  it("is the time alone if today, and the day too if not", () => {
    expect(whenLabel(at(2026, 9, 13, 16, 30), NOW, "en")).toMatch(/4:30|16:30/);
    const tomorrow = at(2026, 9, 14, 9, 5);
    expect(whenLabel(tomorrow, NOW, "en")).toMatch(/Oct/);
    expect(whenLabel(tomorrow, NOW, "en")).not.toMatch(/2026/);
    expect(whenLabel(at(2027, 0, 1, 9, 5), NOW, "en")).toMatch(/2027/);
    expect(whenLabel(tomorrow, NOW, "xx-nowhere")).toBeTruthy();
  });

  it("goes to Ionic's date picker and back without losing a minute", () => {
    const moment = at(2026, 9, 14, 9, 5);
    expect(toIso(moment)).toBe("2026-10-14T09:05");
    expect(fromIso(toIso(moment))).toBe(moment);
    expect(fromIso("2026-10-14T09:05:00")).toBe(moment);
    expect(fromIso("2026-10-14")).toBe(at(2026, 9, 14, 0, 0));
    expect(fromIso("")).toBeNull();
    expect(fromIso(undefined)).toBeNull();
    expect(fromIso(["2026-10-14T09:05:00"])).toBeNull();
    expect(fromIso("nonsense")).toBeNull();
    expect(fromIso("2026-13-40T09:05")).toBeNull();
  });
});

describe("the catalogue", () => {
  it("speaks the 21 languages of the app, with the same keys in each and none left empty", () => {
    expect(LANGUAGES).toHaveLength(21);
    const keys = Object.keys(catalogueOf("en")).sort();
    for (const lang of LANGUAGES) {
      expect(Object.keys(catalogueOf(lang)).sort(), lang).toEqual(keys);
      for (const key of keys) expect(catalogueOf(lang)[key].trim(), `${lang}.${key}`).not.toBe("");
      expect(catalogueOf(lang).setFor, lang).toContain("{when}");
    }
  });

  it("falls back to the base language and then to English", () => {
    expect(t("pt-BR", "back")).toBe("Voltar");
    expect(t("xx", "back")).toBe("Back");
    expect(t("es", "no-such-key")).toBe("no-such-key");
  });

  it("puts the moment into the sentence that says it", () => {
    expect(t("en", "setFor", { when: "19:00" })).toBe("Reminder set for 19:00");
    expect(t("es", "setFor", { when: "19:00" })).toContain("19:00");
    expect(t("en", "back", { when: "19:00" })).toBe("Back");
  });
});

describe("the manifest", () => {
  const LOCALES = ["es", "pt", "fr", "de", "it", "ro", "ru", "uk", "pl", "tr", "ar", "hi", "bn", "id", "vi", "th", "ja", "ko", "zh-CN", "zh-TW"];
  const codePoints = (text) => [...text].length;

  it("is a tool that opens a message's text and sets reminders, on an app that lends Ionic", () => {
    expect(manifest).toMatchObject({
      id: "com.flickertalk.remind",
      name: "Reminders",
      version: "1.0.1",
      icon: "alarm-outline",
      minCoreVersion: "1.6.0",
      components: ["ft-remind"],
      permissions: { messages: "given", remind: true },
      opens: ["text/plain"],
      summary: "Set a reminder on a message: a notification for you alone, kept on this phone.",
    });
    expect(Object.keys(manifest.permissions).sort()).toEqual(["messages", "remind"]);
    expect(manifest).not.toHaveProperty("kind");
    expect(JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")).version).toBe(manifest.version);
  });

  it("names and sums up the plugin in the 20 other languages of the app, within the SDK's limits", () => {
    expect(Object.keys(manifest.locales ?? {})).toEqual(LOCALES);
    expect(manifest.locales.es).toEqual({
      name: "Recordatorios",
      summary: "Pon un recordatorio a un mensaje: un aviso solo para ti, guardado en este teléfono.",
    });
    for (const lang of LOCALES) {
      const { name, summary } = manifest.locales[lang];
      expect(summary, lang).toBeTypeOf("string");
      expect(codePoints(summary.trim()), lang).toBeGreaterThan(0);
      expect(codePoints(summary), lang).toBeLessThanOrEqual(200);
      expect(name, lang).toBeTypeOf("string");
      expect(codePoints(name.trim()), lang).toBeGreaterThan(0);
      expect(codePoints(name), lang).toBeLessThanOrEqual(64);
    }
  });

  it("calls the plugin in each language what the plugin calls itself", () => {
    expect(catalogueOf("en").title).toBe(manifest.name);
    for (const lang of LOCALES) {
      expect(LANGUAGES, lang).toContain(lang);
      expect(manifest.locales?.[lang]?.name, lang).toBe(catalogueOf(lang).title);
    }
  });
});

describe("the package", () => {
  const dist = join(HERE, "dist");
  const files = readdirSync(dist);

  it("carries no Ionic of its own", () => {
    for (const file of files) {
      const code = readFileSync(join(dist, file), "utf8");
      expect(code, file).not.toMatch(/@ionic\/core|ionicframework|stencil|defineCustomElement|__registerHost/i);
      expect(code, file).not.toMatch(/^\s*import\s.*from\s+["'](?!\.\/)/m);
    }
  });

  it("stays under 128 KiB", () => {
    const bytes = files.reduce((sum, file) => sum + statSync(join(dist, file)).size, 0);
    expect(bytes).toBeLessThanOrEqual(128 * 1024);
  });

  const LENT = [
    "add-outline", "alarm-outline", "albums-outline", "apps-outline", "arrow-back-outline", "arrow-redo-outline",
    "arrow-undo-outline", "arrow-up-outline", "basket-outline", "boat-outline", "book-outline", "brush-outline",
    "calculator-outline", "calendar-outline", "camera-outline", "chatbubble-outline", "checkbox-outline",
    "checkmark-outline", "close-outline", "cloud-done-outline", "cloud-outline", "cloud-upload-outline",
    "code-slash-outline", "color-palette-outline", "construct-outline", "contrast-outline", "crop-outline",
    "cube-outline", "cut-outline", "dice-outline", "document-outline", "document-text-outline", "download-outline",
    "easel-outline", "ellipse-outline", "ellipsis-horizontal-outline", "expand-outline", "extension-puzzle-outline",
    "eye-off-outline", "eye-outline", "folder-open-outline", "folder-outline", "game-controller-outline",
    "grid-outline", "hand-left-outline", "image-outline", "key-outline", "language-outline", "link-outline",
    "list-outline", "location-outline", "lock-closed-outline", "map-outline", "mic-outline", "move-outline",
    "musical-notes-outline", "options-outline", "pause-outline", "pencil-outline", "play-outline", "qr-code-outline",
    "radio-button-on-outline", "reader-outline", "refresh-outline", "remove-outline", "resize-outline", "save-outline",
    "scan-outline", "search-outline", "send-outline", "shield-outline", "sparkles-outline", "square-outline",
    "stats-chart-outline", "text-outline", "time-outline", "timer-outline", "trash-outline", "trophy-outline",
  ];

  it("names only icons the app lends", () => {
    const code = readFileSync(join(dist, "index.js"), "utf8");
    const named = [...new Set([...code.matchAll(/"([a-z0-9]+(?:-[a-z0-9]+)*-outline)"/g)].map(([, name]) => name))];
    expect(named.length).toBeGreaterThan(0);
    for (const name of named) expect(LENT, name).toContain(name);
    expect(LENT).toContain(manifest.icon);
  });
});

describe("the image of the Apps grid", () => {
  const image = join(HERE, "icon.svg");

  it("is a square 64 × 64 SVG of at most 4 KB at the root of the package, and not inside dist/", () => {
    expect(existsSync(image), "icon.svg").toBe(true);
    expect(statSync(image).size).toBeLessThanOrEqual(4096);
    const svg = readFileSync(image, "utf8");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('viewBox="0 0 64 64"');
    expect(existsSync(join(HERE, "dist", "icon.svg"))).toBe(false);
  });
});

function fakeCore() {
  const records = new Map();
  const settings = new Map();
  const reminders = new Map();
  const handlers = [];
  return {
    records,
    settings,
    reminders,
    open: (opening) => Promise.all(handlers.map((handler) => handler({ text: "", dark: false, lang: "en", file: null, ref: null, reminder: null, live: false, ...opening }))),
    ft: {
      onOpen: (handler) => handlers.push(handler),
      store: {
        get: async (key) => settings.get(key) ?? null,
        set: async (key, value) => settings.set(key, value) && true,
        forget: async (key) => settings.delete(key),
      },
      records: {
        get: async (key) => records.get(key) ?? null,
        set: vi.fn(async (key, value) => (value.length > 10_000 ? false : (records.set(key, value), true))),
        forget: vi.fn(async (key) => records.delete(key)),
        keys: async (prefix) => [...records.keys()].filter((key) => key.startsWith(prefix)).sort(),
        usage: async () => ({ used: 0, quota: 4_000_000 }),
      },
      remind: {
        set: vi.fn(async (id, at, text) => (reminders.set(id, { at, text }), true)),
        cancel: vi.fn(async (id) => reminders.delete(id)),
        list: async () => [...reminders].map(([id, one]) => ({ plugin: "com.flickertalk.remind", id, ...one })),
      },
      notify: vi.fn(),
      openChat: vi.fn(async () => false),
      close: vi.fn(),
    },
  };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the plugin", () => {
  let core;
  let element;
  const inside = () => element;
  const press = async (act, key) => {
    inside().querySelector(`[data-act="${act}"]${key ? `[data-key="${key}"]` : ""}`).click();
    for (let wait = 0; wait < 4; wait += 1) await tick();
  };
  const label = (one) => one?.getAttribute("aria-label") ?? one?.shadowRoot?.querySelector("button")?.getAttribute("aria-label") ?? null;
  const open = async (id) => {
    inside().querySelector(`[data-act="open"][data-id="${id}"]`).click();
    for (let wait = 0; wait < 4; wait += 1) await tick();
  };
  const answer = async (role) => {
    let alert = null;
    for (let wait = 0; wait < 50 && !(alert = document.querySelector("ion-alert")); wait += 1) await tick();
    if (!alert) throw new Error("no alert");
    await alert.dismiss(undefined, role);
    for (let wait = 0; wait < 6; wait += 1) await tick();
    return alert;
  };
  const kept = () => [...core.records.values()].map((json) => JSON.parse(json));
  const says = (row) => [...row.querySelectorAll("ion-label h2, ion-label p")].map((line) => line.textContent).join("\n");
  const record = (reminder) => core.records.set(`reminder/${reminder.id}`, JSON.stringify({ createdAt: 1, ...reminder }));

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"], shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
    core = fakeCore();
    globalThis.ft = core.ft;
    globalThis.confirm = () => {
      throw new Error("no browser dialogs in the frame");
    };
    document.body.innerHTML = "";
    element = document.createElement("ft-remind");
    document.body.append(element);
  });

  afterEach(async () => {
    for (const alert of document.querySelectorAll("ion-alert")) await alert.dismiss();
    delete globalThis.confirm;
    delete globalThis.Ionicons;
    vi.useRealTimers();
  });

  it("quotes the message the user handed over and offers the moments, each with its icon", async () => {
    await core.open({ text: "Call the bank\nabout the card", ref: "ref_7" });
    expect(inside().querySelector(".quote").textContent).toBe("Call the bank\nabout the card");
    const choices = [...inside().querySelectorAll('ion-button[data-act="preset"]')];
    expect(choices.map((one) => one.dataset.key)).toEqual(["hour", "evening", "morning"]);
    expect(choices.map((one) => one.textContent)).toEqual([
      expect.stringContaining("In 1 hour"),
      expect.stringContaining("This evening"),
      expect.stringContaining("Tomorrow morning"),
    ]);
    for (const one of [...choices, inside().querySelector('ion-button[data-act="pick"]')]) {
      expect(one.getAttribute("expand")).toBe("block");
      expect(one.querySelector('[slot="start"]')).not.toBeNull();
    }
    expect(inside().querySelector('ion-button[data-act="pick"]').textContent).toContain("Pick a date and time");
    expect(core.ft.remind.set).not.toHaveBeenCalled();
    expect(core.records.size).toBe(0);
  });

  it("sets a reminder through the core with one tap, keeps it, says so, and lists it", async () => {
    await core.open({ text: "Call the bank\nabout the card", ref: "ref_7" });
    await press("preset", "evening");
    expect(core.ft.remind.set).toHaveBeenCalledTimes(1);
    const [id, at, text] = core.ft.remind.set.mock.calls[0];
    expect(at).toBe(new Date(2026, 9, 13, 19, 0).getTime());
    expect(text).toBe("", "the lock screen says nothing of the message unless allowed");
    expect(JSON.parse(core.records.get(`reminder/${id}`))).toEqual({ id, text: "Call the bank\nabout the card", ref: "ref_7", at, createdAt: NOW });
    expect(core.ft.notify).toHaveBeenCalledWith(t("en", "setFor", { when: whenLabel(at, NOW, "en") }));
    expect(inside().querySelectorAll('[data-act="open"]')).toHaveLength(1);
    expect(says(inside().querySelector(`[data-act="open"][data-id="${id}"]`))).toContain("Call the bank");
  });

  it("does not offer this evening when it is almost here", async () => {
    vi.setSystemTime(new Date(2026, 9, 13, 18, 45).getTime());
    await core.open({ text: "x" });
    expect([...inside().querySelectorAll('[data-act="preset"]')].map((one) => one.dataset.key)).toEqual(["hour", "morning"]);
  });

  it("sets a reminder at the moment picked in Ionic's date picker, and only one still to come", async () => {
    await core.open({ text: "Pay the rent", lang: "es" });
    expect(inside().querySelector("ion-datetime")).toBeNull();
    await press("pick");
    const picker = inside().querySelector("ion-datetime");
    expect(picker.getAttribute("presentation")).toBe("date-time");
    expect(picker.getAttribute("min")).toBe(toIso(NOW));
    expect(picker.getAttribute("locale")).toBe("es");
    expect(inside().querySelector('ion-button[data-act="setPicked"]').textContent).toContain("Poner");

    picker.value = "2026-10-12T09:00:00";
    await press("setPicked");
    expect(core.ft.remind.set).not.toHaveBeenCalled();
    expect(inside().querySelector(".warn").textContent).toBe(t("es", "future"));

    inside().querySelector("ion-datetime").value = "2026-10-20T08:30:00";
    await press("setPicked");
    expect(core.ft.remind.set).toHaveBeenCalledWith(expect.any(String), new Date(2026, 9, 20, 8, 30).getTime(), "");
    expect(kept()).toHaveLength(1);
  });

  it("warns, and keeps nothing, when the app did not allow reminders", async () => {
    core.ft.remind.set.mockResolvedValueOnce(false);
    await core.open({ text: "Call the bank" });
    await press("preset", "hour");
    expect(inside().querySelector(".warn").textContent).toBe("This plugin was not allowed to set reminders");
    expect(core.records.size).toBe(0);
    expect(core.ft.notify).not.toHaveBeenCalled();
    expect(inside().querySelector(".quote")).not.toBeNull();
  });

  it("takes the reminder back when there is no room to keep it", async () => {
    await core.open({ text: "x".repeat(20_000) });
    await press("preset", "hour");
    expect(inside().querySelector(".warn").textContent).toBe("No room left for this reminder");
    const [id] = core.ft.remind.set.mock.calls[0];
    expect(core.ft.remind.cancel).toHaveBeenCalledWith(id);
    expect(core.reminders.size).toBe(0);
  });

  it("works on an app that cannot show a notice", async () => {
    delete core.ft.notify;
    await core.open({ text: "Call the bank" });
    await press("preset", "morning");
    expect(kept()).toHaveLength(1);
  });

  it("lists the reminders still to come first, then the past ones, marked, and shows which came from a conversation", async () => {
    record({ id: "a", text: "Went off a moment ago", at: NOW - 1000 });
    record({ id: "b", text: "Later, from a chat\nsecond line", ref: "ref_b", at: NOW + 100_000 });
    record({ id: "c", text: "Soon", at: NOW + 5000 });
    record({ id: "d", text: "Went off long ago", ref: "ref_d", at: NOW - 90_000 });
    core.records.set("reminder/broken", "not a reminder");
    core.records.set("other/x", JSON.stringify({ id: "x", text: "not ours", at: NOW + 1 }));
    await core.open({});
    const rows = [...inside().querySelectorAll('ion-list ion-item[data-act="open"]')];
    expect(rows.map((row) => row.dataset.id)).toEqual(["c", "b", "a", "d"]);
    expect(rows.map((row) => row.classList.contains("past"))).toEqual([false, false, true, true]);
    expect(says(rows[2])).toContain("Past");
    expect(says(rows[0])).not.toContain("Past");
    expect(says(rows[1])).toContain("Later, from a chat");
    expect(says(rows[1])).not.toContain("second line");
    const fromChat = rows.map((row) => row.querySelector('[aria-label="From a conversation"]') !== null);
    expect(fromChat).toEqual([false, true, false, true]);
  });

  it("says how to set one when there is none", async () => {
    await core.open({ lang: "es" });
    expect(inside().querySelector(".empty").textContent.trim()).toBe("Mantén pulsado un mensaje y elige Abrir con un plugin → Recordatorios");
  });

  it("opens a reminder from the list and leads back to its conversation, or says it is gone", async () => {
    record({ id: "b", text: "Call the bank\nabout the card", ref: "ref_b", at: NOW + 100_000 });
    await core.open({});
    await open("b");
    expect(inside().querySelector(".quote").textContent).toBe("Call the bank\nabout the card");
    expect(inside().querySelector(".quote").classList.contains("cut")).toBe(false);
    expect(inside().querySelector(".when").textContent).toContain(whenLabel(NOW + 100_000, NOW, "en"));
    expect(inside().textContent).toContain("Change the time");

    core.ft.openChat.mockResolvedValueOnce(true);
    await press("chat");
    expect(core.ft.openChat).toHaveBeenLastCalledWith("ref_b");
    expect(inside().textContent).not.toContain("That conversation is gone");
    await press("chat");
    expect(inside().textContent).toContain("That conversation is gone");
    expect(inside().querySelector('[data-act="chat"]')).toBeNull();

    await press("back");
    expect(inside().querySelectorAll('[data-act="open"]')).toHaveLength(1);
  });

  it("opens the reminder a tapped notification belongs to", async () => {
    record({ id: "a", text: "Ring mum", at: NOW - 1000 });
    record({ id: "b", text: "Other", at: NOW + 1000 });
    await core.open({ reminder: "a" });
    expect(inside().querySelector(".quote").textContent).toBe("Ring mum");
    expect(inside().querySelector(".when").textContent).toContain("Past");
    expect(inside().textContent).toContain("Remind me again");
    expect(inside().querySelector('[data-act="chat"]')).toBeNull();
  });

  it("shows the list when the tapped reminder is no longer there", async () => {
    record({ id: "b", text: "Other", at: NOW + 1000 });
    await core.open({ reminder: "gone" });
    expect(inside().querySelectorAll('[data-act="open"]')).toHaveLength(1);
  });

  it("reminds again: the same reminder moves to the new moment", async () => {
    record({ id: "a", text: "Ring mum", ref: "ref_a", at: NOW - 1000 });
    await core.open({ reminder: "a" });
    await press("preset", "hour");
    const later = new Date(2026, 9, 13, 11, 0).getTime();
    expect(core.ft.remind.set).toHaveBeenCalledWith("a", later, "");
    expect(JSON.parse(core.records.get("reminder/a"))).toEqual({ id: "a", text: "Ring mum", ref: "ref_a", at: later, createdAt: 1 });
    expect(core.records.size).toBe(1);
    expect(core.ft.notify).toHaveBeenCalledWith(t("en", "setFor", { when: whenLabel(later, NOW, "en") }));
    expect(inside().querySelector(".when").textContent).not.toContain("Past");
    expect(inside().textContent).toContain("Change the time");
  });

  it("keeps the old moment when the new one cannot be written down", async () => {
    const soon = NOW + 100_000;
    record({ id: "a", text: "Ring mum", at: soon });
    await core.open({ reminder: "a" });
    core.ft.records.set.mockResolvedValueOnce(false);
    await press("preset", "morning");
    expect(inside().querySelector(".warn").textContent).toBe("No room left for this reminder");
    expect(core.ft.remind.set).toHaveBeenLastCalledWith("a", soon, "");
    expect(core.reminders.get("a").at).toBe(soon);
    expect(JSON.parse(core.records.get("reminder/a")).at).toBe(soon);
  });

  it("deletes a reminder only once the user says so in Ionic's alert, and cancels it in the core", async () => {
    record({ id: "a", text: "Ring mum", at: NOW + 100_000 });
    await core.open({ reminder: "a" });
    await press("delete");
    expect((await answer("cancel")).message).toBe("Delete this reminder?");
    expect(core.records.size).toBe(1);
    expect(core.ft.remind.cancel).not.toHaveBeenCalled();

    await press("delete");
    await answer("destructive");
    expect(core.ft.remind.cancel).toHaveBeenCalledWith("a");
    expect(core.ft.records.forget).toHaveBeenCalledWith("reminder/a");
    expect(core.records.size).toBe(0);
    expect(inside().querySelector(".empty")).not.toBeNull();
  });

  it("says the message in the notification only once the user turns that on, for every reminder still to come", async () => {
    record({ id: "a", text: "Secret plan\nwith details", at: NOW + 100_000 });
    record({ id: "b", text: "Gone off", at: NOW - 1000 });
    await core.open({});
    await press("settings");
    expect(label(element.querySelector(':scope > ion-header ion-button[data-act="back"]'))).toBe("Back");
    const toggle = element.querySelector(':scope > ion-content ion-toggle[name="showText"]');
    expect(toggle.checked).toBe(false);
    expect(toggle.textContent).toBe("Show the message text in the notification");
    expect(inside().textContent).toContain("Off: the notification only says you have a reminder.");

    const turn = async (checked) => {
      const one = inside().querySelector('ion-toggle[name="showText"]');
      one.checked = checked;
      one.dispatchEvent(new CustomEvent("ionChange", { bubbles: true, detail: { checked } }));
      for (let wait = 0; wait < 4; wait += 1) await tick();
    };
    await turn(true);
    expect(await core.ft.store.get("showText")).toBe("1");
    expect(core.ft.remind.set).toHaveBeenCalledTimes(1);
    expect(core.ft.remind.set).toHaveBeenCalledWith("a", NOW + 100_000, "Secret plan");

    await core.open({ text: "Buy milk\nand bread" });
    await press("preset", "hour");
    expect(core.ft.remind.set).toHaveBeenLastCalledWith(expect.any(String), new Date(2026, 9, 13, 11, 0).getTime(), "Buy milk");

    await press("settings");
    expect(inside().querySelector('ion-toggle[name="showText"]').checked).toBe(true);
    await turn(false);
    expect(await core.ft.store.get("showText")).toBe("0");
    expect(core.reminders.get("a").text).toBe("");
    expect([...core.reminders.values()].every((one) => one.text === "")).toBe(true);
    await press("back");
    expect(inside().querySelectorAll('[data-act="open"]')).toHaveLength(3);
  });

  it("sets one reminder for a double tap", async () => {
    await core.open({ text: "Call the bank" });
    const hour = inside().querySelector('[data-act="preset"][data-key="hour"]');
    hour.click();
    hour.click();
    for (let wait = 0; wait < 6; wait += 1) await tick();
    expect(core.ft.remind.set).toHaveBeenCalledTimes(1);
    expect(core.records.size).toBe(1);
  });

  it("is born with no attributes, and leaves the page like any element", () => {
    expect(document.createElement("ft-remind").attributes).toHaveLength(0);
    element.remove();
    expect(element.isConnected).toBe(false);
    expect(document.querySelector("ion-alert")).toBeNull();
  });

  it("draws an Ionicon the app lent by name with ion-icon, and the one it serves otherwise", async () => {
    await core.open({});
    expect(element.querySelector('[data-act="settings"] [slot="icon-only"]').getAttribute("style")).toContain("./icon/options-outline.svg");
    globalThis.Ionicons = { map: new Map([["options-outline", "data:image/svg+xml;utf8,<svg></svg>"]]) };
    element.paint();
    expect(element.querySelector('[data-act="settings"] ion-icon[slot="icon-only"]').getAttribute("name")).toBe("options-outline");
  });

  it("draws in the page, each screen in Ionic's header and content, with no close of its own", async () => {
    await core.open({ text: "Call the bank", ref: "ref_7" });
    expect(element.shadowRoot).toBe(null);
    expect(label(element.querySelector(':scope > ion-header > ion-toolbar ion-button[data-act="back"]'))).toBe("Back");
    expect(element.querySelector(":scope > ion-content .quote")).not.toBeNull();
    expect(element.querySelector('[data-act="close"]')).toBeNull();

    await press("back");
    expect(core.records.size).toBe(0);
    expect(label(element.querySelector(':scope > ion-header > ion-toolbar ion-button[data-act="settings"]'))).toBe("Settings");
    expect(element.querySelector(":scope > ion-content .empty")).not.toBeNull();
    expect(element.querySelector('[data-act="close"]')).toBeNull();

    record({ id: "a", text: "Ring mum", at: NOW + 1000 });
    await core.open({ reminder: "a" });
    const bar = element.querySelector(":scope > ion-header > ion-toolbar");
    for (const act of ["back", "delete"]) expect(label(bar.querySelector(`ion-button[data-act="${act}"]`)), act).toBeTruthy();
    expect(bar.querySelector('ion-button[data-act="delete"]').getAttribute("color")).toBe("danger");
    expect(element.querySelector(":scope > ion-content .quote")).not.toBeNull();
    expect(element.querySelector('[data-act="close"]')).toBeNull();
  });
});
