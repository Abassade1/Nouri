import Link from "next/link";

import { listCities } from "@/lib/cities";
import { requireAdmin } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";

export default async function Cities() {
  await requireAdmin();
  const { m, pick } = await getI18n();
  const cities = await listCities();
  const t = m.cities;

  return (
    <>
      <div className="title-row">
        <div>
          <h1>{t.title}</h1>
          <p className="muted">{t.subtitle}</p>
        </div>
        <Link href="/cities/new" className="btn btn-primary">{t.add}</Link>
      </div>

      {cities.length === 0 ? <p className="empty">{t.empty}</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>{(["city", "country", "currency", "language", "commission", "taxes", "services", "status"] as const).map((c) => <th key={c}>{t.cols[c]}</th>)}</tr>
            </thead>
            <tbody>
              {cities.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/cities/${c.id}`} className="row-link">{pick(c.name_i18n)}</Link><div className="muted small">{c.region_code}</div></td>
                  <td>{c.country_code}</td>
                  <td>{c.currency}</td>
                  <td>{c.default_language.toUpperCase()}</td>
                  <td>{(c.commission_rate * 100).toLocaleString("en", { maximumFractionDigits: 2 })}%</td>
                  <td>{c.tax_components.length ? c.tax_components.map((x) => `${x.code} ${(x.rate * 100).toLocaleString("en", { maximumFractionDigits: 3 })}%`).join(" + ") : t.none}</td>
                  <td>{c.services}</td>
                  <td><span className={`chip ${c.is_active ? "chip-approved" : ""}`}>{c.is_active ? t.status.live : t.status.closed}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
