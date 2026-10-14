import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";
import { missingTranslations } from "@/lib/service-form";
import { listServices } from "@/lib/services";

/** Languages the apps are published in; a service missing any of these shows English there instead. */
const APP_LANGS = ["en", "fr", "ar"];

export default async function Services() {
  await requireAdmin();
  const { m, fill, pick } = await getI18n();
  const rows = await listServices();
  const t = m.services;

  return (
    <>
      <div className="title-row">
        <div><h1>{t.title}</h1><p className="muted">{t.subtitle}</p></div>
        <Link href="/services/new" className="btn btn-primary">{t.add}</Link>
      </div>

      {rows.length === 0 ? <p className="empty">{t.empty}</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr>{(["service", "unit", "cities", "carers", "translations", "status"] as const).map((c) => <th key={c}>{t.cols[c]}</th>)}</tr></thead>
            <tbody>
              {rows.map((s) => {
                const missing = missingTranslations(s, APP_LANGS);
                return (
                  <tr key={s.id}>
                    <td><Link href={`/services/${s.id}`} className="row-link">{pick(s.name_i18n)}</Link><div className="muted small" dir="ltr">{s.slug}</div></td>
                    <td>{m.unit[s.rate_unit as keyof typeof m.unit] ?? s.rate_unit}</td>
                    <td>{s.cities}</td>
                    <td>{s.carers}</td>
                    <td>{missing.length === 0 ? <span className="muted small">{t.complete}</span> : <span className="chip chip-out-open">{fill(t.missing, { langs: missing.map((l) => l.toUpperCase()).join(", ") })}</span>}</td>
                    <td><span className={`chip ${s.is_active ? "chip-approved" : ""}`}>{s.is_active ? t.status.active : t.status.retired}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
