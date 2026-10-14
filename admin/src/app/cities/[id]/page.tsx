import Link from "next/link";
import { notFound } from "next/navigation";

import { saveCityAction } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { getCity } from "@/lib/cities";
import { TAX_ROWS } from "@/lib/city-form";
import { getI18n } from "@/lib/i18n";

export default async function CityDetail({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { error, saved } = await searchParams;
  const c = await getCity(id);
  if (!c) notFound();

  const { m, fill, pick, dateTime } = await getI18n();
  const t = m.cities.detail;
  const errorText = error ? (m.errors[error as keyof typeof m.errors] ?? m.errors.generic) : null;
  const pct = (r: number) => String(Math.round(r * 1e5) / 1e3);
  const taxRows = Array.from({ length: TAX_ROWS }, (_, i) => c.tax_components[i] ?? null);

  return (
    <>
      <Link href="/cities" className="back">← {t.back}</Link>
      <div className="title-row">
        <div><h1>{pick(c.name_i18n)}</h1><p className="muted small" dir="ltr">{c.slug} · {c.country_code} · {c.timezone} · {c.currency}</p></div>
        <span className={`chip ${c.is_active ? "chip-approved" : ""}`}>{c.is_active ? m.cities.status.live : m.cities.status.closed}</span>
      </div>
      {saved ? <p className="ok" role="status">{t.saved}</p> : null}
      {errorText ? <p className="error" role="alert">{errorText}</p> : null}

      <form action={saveCityAction} className="stack">
        <input type="hidden" name="cityId" value={c.id} />

        <section className="card">
          <h2>{t.identity}</h2>
          <p className="muted small">{t.names}</p>
          <div className="grid2">
            {(["en", "fr", "ar", "zh"] as const).map((l) => (
              <label key={l} className="field"><span>{l.toUpperCase()}</span><input name={`name_${l}`} defaultValue={c.name_i18n[l] ?? ""} required={l === "en"} dir="auto" /></label>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>{t.money}</h2>
          <p className="muted small">{t.moneyHelp}</p>
          <label className="field"><span>{t.commission}</span><input name="commission" defaultValue={pct(c.commission_rate)} inputMode="decimal" dir="ltr" required /><small className="muted">{t.commissionHelp}</small></label>
          <h3>{t.taxes}</h3>
          <p className="muted small">{t.taxHelp}</p>
          <div className="tax-grid">
            {taxRows.map((row, i) => (
              <div key={i} className="tax-row">
                <label className="field"><span>{t.taxCode}</span><input name={`taxCode${i}`} defaultValue={row?.code ?? ""} dir="ltr" maxLength={12} /></label>
                <label className="field"><span>{t.taxRate}</span><input name={`taxRate${i}`} defaultValue={row ? pct(row.rate) : ""} inputMode="decimal" dir="ltr" /></label>
              </div>
            ))}
          </div>
          <div className="grid2">
            <label className="field"><span>{t.refundHours}</span><input name="refundHours" defaultValue={c.cancellation_full_refund_hours} inputMode="numeric" dir="ltr" required /></label>
            <label className="field"><span>{t.latePct}</span><input name="latePct" defaultValue={c.cancellation_late_refund_pct} inputMode="numeric" dir="ltr" required /></label>
            <label className="field"><span>{t.holdHours}</span><input name="holdHours" defaultValue={c.payout_hold_hours} inputMode="numeric" dir="ltr" required /></label>
          </div>
        </section>

        <section className="card">
          <h2>{t.services}</h2>
          <p className="muted small">{t.servicesHelp}</p>
          <ul className="plain">
            {c.services.map((s) => (
              <li key={s.id}>
                <input type="hidden" name="allService" value={s.id} />
                <label className="check"><input type="checkbox" name="service" value={s.id} defaultChecked={s.enabled} /><span>{pick(s.name_i18n)}</span></label>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>{t.launch}</h2>
          <label className="field"><span>{t.areas}</span><input name="areas" defaultValue={c.launch_areas.join(", ")} dir="auto" /></label>
          <label className="check live-switch"><input type="checkbox" name="live" defaultChecked={c.is_active} /><span><strong>{t.liveLabel}</strong><br /><span className="muted small">{t.liveHelp}</span></span></label>
          {c.is_active && c.open_bookings > 0 ? <p className="muted small">{fill(t.openBookings, { count: String(c.open_bookings) })}</p> : null}
          {c.services_enabled === 0 ? <p className="alert-text small">{t.needService}</p> : null}
        </section>

        <div><button className="btn btn-primary">{t.save}</button></div>
      </form>

      <section className="card">
        <h2>{t.history}</h2>
        {c.audit.length === 0 ? <p className="muted">{t.noHistory}</p> : (
          <ul className="plain">
            {c.audit.map((a) => (
              <li key={a.id} className="split">
                <span>{t.what[a.action as keyof typeof t.what] ?? a.action} · {t.what[a.entity as keyof typeof t.what] ?? a.entity}{a.summary ? <span className="muted small" dir="ltr"> · {a.summary}</span> : null}</span>
                <span className="muted small">{dateTime(a.created_at)} · {a.admin_name ? fill(t.by, { name: a.admin_name }) : t.system}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
