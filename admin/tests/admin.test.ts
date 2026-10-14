import assert from "node:assert/strict";
import { test } from "node:test";

import { csvCell, toCsv } from "../src/lib/csv.ts";
import { parseCitySettings, parseNewCity, readNames } from "../src/lib/city-form.ts";
import { financeState, overdueReleases, summarize, type FinanceBooking } from "../src/lib/finance-core.ts";

const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const base = { commission: "15", refundHours: "24", latePct: "50", holdHours: "24", areas: "Aspen Woods, Springbank Hill, Aspen Woods", taxCode0: "GST", taxRate0: "5" };

test("percentages are typed as percentages and stored as fractions", () => {
  const r = parseCitySettings(form({ ...base, taxCode1: "QST", taxRate1: "9.975" }));
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.commission_rate, 0.15);
    assert.deepEqual(r.value.tax_components, [{ code: "GST", rate: 0.05 }, { code: "QST", rate: 0.09975 }]);
    assert.deepEqual(r.value.launch_areas, ["Aspen Woods", "Springbank Hill"]); // de-duplicated
  }
});

test("a comma as the decimal separator works (French keyboards)", () => {
  const r = parseCitySettings(form({ ...base, taxCode0: "QST", taxRate0: "9,975" }));
  assert.ok(r.ok && r.value.tax_components[0].rate === 0.09975);
});

test("bad money settings are refused with a clear reason", () => {
  assert.deepEqual(parseCitySettings(form({ ...base, commission: "75" })), { ok: false, error: "invalid_commission" });
  assert.deepEqual(parseCitySettings(form({ ...base, commission: "" })), { ok: false, error: "invalid_commission" });
  assert.deepEqual(parseCitySettings(form({ ...base, taxRate0: "150" })), { ok: false, error: "invalid_tax" });
  assert.deepEqual(parseCitySettings(form({ ...base, taxCode0: "", taxRate0: "5" })), { ok: false, error: "invalid_tax" });
  assert.deepEqual(parseCitySettings(form({ ...base, taxCode1: "gst", taxRate1: "5" })), { ok: false, error: "invalid_tax" }); // duplicate code
  assert.deepEqual(parseCitySettings(form({ ...base, latePct: "120" })), { ok: false, error: "invalid_hours" });
  assert.deepEqual(parseCitySettings(form({ ...base, holdHours: "2.5" })), { ok: false, error: "invalid_hours" });
});

test("blank tax rows are ignored; no taxes at all is allowed", () => {
  const r = parseCitySettings(form({ ...base, taxCode0: "", taxRate0: "" }));
  assert.ok(r.ok && r.value.tax_components.length === 0);
});

test("a new city needs a valid slug, time zone, currency and an English name", () => {
  const ok = { slug: "calgary-2", country: "ca", region: "AB", timezone: "America/Edmonton", currency: "cad", defaultLanguage: "en", name_en: "Calgary" };
  const r = parseNewCity(form(ok), ["en", "fr", "ar"]);
  assert.ok(r.ok && r.value.currency === "CAD" && r.value.country_code === "CA");
  assert.deepEqual(parseNewCity(form({ ...ok, slug: "Bad Slug!" }), ["en"]), { ok: false, error: "invalid_slug" });
  assert.deepEqual(parseNewCity(form({ ...ok, timezone: "Mars/Olympus" }), ["en"]), { ok: false, error: "invalid_timezone" });
  assert.deepEqual(parseNewCity(form({ ...ok, name_en: "" }), ["en"]), { ok: false, error: "name_required" });
  assert.deepEqual(parseNewCity(form({ ...ok, defaultLanguage: "de" }), ["en", "fr"]), { ok: false, error: "invalid_city" });
});

test("editing names keeps languages the form doesn't show, and blanking one removes it", () => {
  assert.deepEqual(readNames(form({ name_en: "Calgary", name_fr: "Calgary", name_ar: "كالغاري" }), { en: "x", zh: "卡尔加里" }), { en: "Calgary", fr: "Calgary", ar: "كالغاري", zh: "卡尔加里" });
  assert.deepEqual(readNames(form({ name_en: "Calgary", name_fr: "" }), { en: "x", fr: "old" }), { en: "Calgary" });
});

const b = (o: Partial<FinanceBooking>): FinanceBooking => ({
  id: "x", status: "completed", currency: "CAD", total_cents: 3675, refunded_cents: 0, commission_cents: 525, tax_cents: 175,
  carer_payout_cents: 2975, paid_at: "2026-10-01T00:00:00Z", completed_at: "2026-10-02T00:00:00Z", transferred_at: null, hold_hours: 24, ...o,
});

test("money states", () => {
  assert.equal(financeState(b({ transferred_at: "t" })), "released");
  assert.equal(financeState(b({})), "awaiting_release");
  assert.equal(financeState(b({ status: "confirmed" })), "confirmed");
  assert.equal(financeState(b({ status: "disputed" })), "disputed");
  assert.equal(financeState(b({ status: "cancelled", refunded_cents: 3675 })), "refunded");
  assert.equal(financeState(b({ status: "cancelled", refunded_cents: 0 })), "cancelled");
});

test("totals add up, per currency, ignoring unpaid bookings", () => {
  const rows = [
    b({ transferred_at: "t" }),                                              // released
    b({ id: "2" }),                                                           // awaiting release
    b({ id: "3", status: "confirmed", completed_at: null }),                  // upcoming
    b({ id: "4", status: "disputed" }),                                       // held
    b({ id: "5", status: "cancelled", refunded_cents: 3675 }),                // refunded
    b({ id: "6", status: "requested", paid_at: null }),                       // never paid: ignored
    b({ id: "7", currency: "AED", total_cents: 10000, commission_cents: 1500, tax_cents: 500, carer_payout_cents: 8500, transferred_at: "t" }),
  ];
  const [aed, cad] = summarize(rows);
  assert.equal(cad.currency, "CAD");
  assert.equal(cad.charged, 3675 * 5);
  assert.equal(cad.refunded, 3675);
  assert.equal(cad.net, 3675 * 4);
  assert.equal(cad.commission, 525 * 2);   // released + awaiting only
  assert.equal(cad.tax, 175 * 2);
  assert.equal(cad.paidOut, 2975);
  assert.equal(cad.owed, 2975 * 2);        // awaiting + upcoming
  assert.equal(cad.held, 2975);
  assert.equal(aed.currency, "AED");
  assert.equal(aed.charged, 10000);
});

test("overdue releases = completed, paid, not transferred, and past hold + grace", () => {
  const now = new Date("2026-10-10T00:00:00Z");
  const rows = [
    b({ id: "late", completed_at: "2026-10-05T00:00:00Z" }),
    b({ id: "recent", completed_at: "2026-10-09T20:00:00Z" }),
    b({ id: "done", completed_at: "2026-10-05T00:00:00Z", transferred_at: "t" }),
  ];
  assert.deepEqual(overdueReleases(rows, now).map((x) => x.id), ["late"]);
});

test("CSV escapes quotes and commas, and neutralises spreadsheet formulas", () => {
  assert.equal(csvCell('Biscuit, "Bix"'), '"Biscuit, ""Bix"""');
  assert.equal(csvCell("=HYPERLINK(\"http://evil\")"), "\"'=HYPERLINK(\"\"http://evil\"\")\"");
  assert.equal(csvCell("+1 403 555 0100"), "'+1 403 555 0100");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(42), "42");
  const out = toCsv(["a", "b"], [["x", "y,z"]]);
  assert.ok(out.startsWith("﻿"));
  assert.ok(out.includes('x,"y,z"'));
});

import { demandByCity, type WaitEntry } from "../src/lib/waitlist-core.ts";

const w = (o: Partial<WaitEntry>): WaitEntry => ({ id: "x", email: "a@b.co", city_id: "c1", city_name: { en: "Toronto" }, requested_city: null, interest: "owner", language: "en", created_at: "2026-10-01T00:00:00Z", notified_at: null, signed_in: false, ...o });

test("waitlist demand is counted per city, split by owners and carers, busiest first", () => {
  const d = demandByCity([w({}), w({}), w({ interest: "carer", notified_at: "t" }), w({ city_id: "c2", city_name: { en: "Montréal" } })]);
  assert.equal(d[0].total, 3);
  assert.deepEqual([d[0].owners, d[0].carers, d[0].pending], [2, 1, 2]);
  assert.equal(d[1].total, 1);
});

test("cities people typed themselves are merged regardless of case or spacing", () => {
  const d = demandByCity([w({ city_id: null, city_name: null, requested_city: "Halifax" }), w({ city_id: null, city_name: null, requested_city: " halifax " })]);
  assert.equal(d.length, 1);
  assert.equal(d[0].total, 2);
});

import { missingTranslations, parseService, parseSlug } from "../src/lib/service-form.ts";

const svcForm = { name_en: "Nail trim", desc_en: "A quick, calm nail trim at home.", unit: "per_visit", order: "6", icon: "scissors", active: "on" };

test("a service needs an English name and description, a valid unit and a sensible order", () => {
  const r = parseService(form(svcForm));
  assert.ok(r.ok && r.value.rate_unit === "per_visit" && r.value.sort_order === 6 && r.value.is_active && r.value.icon === "scissors");
  assert.deepEqual(parseService(form({ ...svcForm, name_en: " " })), { ok: false, error: "name_required" });
  assert.deepEqual(parseService(form({ ...svcForm, desc_en: "" })), { ok: false, error: "description_required" });
  assert.deepEqual(parseService(form({ ...svcForm, unit: "per_hour" })), { ok: false, error: "invalid_unit" });
  assert.deepEqual(parseService(form({ ...svcForm, order: "-1" })), { ok: false, error: "invalid_order" });
  assert.deepEqual(parseService(form({ ...svcForm, name_en: "x".repeat(81) })), { ok: false, error: "text_too_long" });
});

test("an unticked box means retired, and an unknown icon is dropped rather than stored", () => {
  const { active: _a, ...off } = svcForm;
  const r = parseService(form({ ...off, icon: "<script>" }));
  assert.ok(r.ok && r.value.is_active === false && r.value.icon === null);
});

test("editing keeps translations the form doesn't send and removes ones that are blanked", () => {
  const existing = { name_i18n: { en: "Old", fr: "Vieux", zh: "旧" }, description_i18n: { en: "Old d", fr: "Vieux d" } };
  const r = parseService(form({ ...svcForm, name_fr: "", desc_fr: "Nouvelle description" }), existing);
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(r.value.name_i18n, { en: "Nail trim", zh: "旧" });
    assert.deepEqual(r.value.description_i18n, { en: "A quick, calm nail trim at home.", fr: "Nouvelle description" });
  }
});

test("service short names: lowercase letters, digits and underscores, starting with a letter", () => {
  assert.deepEqual(parseSlug(form({ slug: "Nail_Trim" })), { ok: true, value: "nail_trim" });
  assert.equal(parseSlug(form({ slug: "9lives" })).ok, false);
  assert.equal(parseSlug(form({ slug: "nail trim" })).ok, false);
  assert.equal(parseSlug(form({ slug: "a" })).ok, false);
});

test("missing translations are reported per language", () => {
  assert.deepEqual(missingTranslations({ name_i18n: { en: "A", fr: "B" }, description_i18n: { en: "a" } }, ["en", "fr", "ar"]), ["fr", "ar"]);
  assert.deepEqual(missingTranslations({ name_i18n: { en: "A" }, description_i18n: { en: "a" } }, ["en"]), []);
});
