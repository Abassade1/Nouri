import Link from "next/link";
import { notFound } from "next/navigation";

import { saveServiceAction } from "@/app/actions";
import { ServiceFields } from "@/components/ServiceFields";
import { requireAdmin } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";
import { getService } from "@/lib/services";

export default async function ServiceDetail({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { error, saved } = await searchParams;
  const s = await getService(id);
  if (!s) notFound();

  const { m, fill, pick, dateTime } = await getI18n();
  const t = m.services.detail;
  const what = m.cities.detail.what;
  const errorText = error ? (m.errors[error as keyof typeof m.errors] ?? m.errors.generic) : null;

  return (
    <>
      <Link href="/services" className="back">← {t.back}</Link>
      <div className="title-row">
        <div><h1>{pick(s.name_i18n)}</h1><p className="muted small" dir="ltr">{s.slug}</p></div>
        <span className={`chip ${s.is_active ? "chip-approved" : ""}`}>{s.is_active ? m.services.status.active : m.services.status.retired}</span>
      </div>
      {saved ? <p className="ok" role="status">{t.saved}</p> : null}
      {errorText ? <p className="error" role="alert">{errorText}</p> : null}

      <p className="muted small">{fill(t.impact, { carers: String(s.carers), cities: String(s.cities), bookings: String(s.open_bookings) })}</p>
      {s.cities === 0 ? <p className="muted small">{t.enableHint} <Link href="/cities">{t.goCities} →</Link></p> : null}

      <form action={saveServiceAction} className="stack">
        <input type="hidden" name="serviceId" value={s.id} />
        <ServiceFields m={m} value={s} unitLocked={s.in_use} />
        <div><button className="btn btn-primary">{t.save}</button></div>
      </form>

      <section className="card">
        <h2>{t.history}</h2>
        {s.audit.length === 0 ? <p className="muted">{t.noHistory}</p> : (
          <ul className="plain">
            {s.audit.map((a) => (
              <li key={a.id} className="split">
                <span>{what[a.action as keyof typeof what] ?? a.action}{a.summary ? <span className="muted small" dir="ltr"> · {a.summary}</span> : null}</span>
                <span className="muted small">{dateTime(a.created_at)} · {a.admin_name ? fill(m.cities.detail.by, { name: a.admin_name }) : m.cities.detail.system}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
