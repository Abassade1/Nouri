import Link from "next/link";

import { deleteWaitlistAction, markContactedAction } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";
import { listWaitlist } from "@/lib/waitlist";
import { demandByCity } from "@/lib/waitlist-core";

export default async function Waitlist({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireAdmin();
  const { m, fill, pick, date } = await getI18n();
  const { filter: raw } = await searchParams;
  const filter = raw === "pending" ? "pending" : "all";
  const all = await listWaitlist();
  const rows = filter === "pending" ? all.filter((w) => !w.notified_at) : all;
  const demand = demandByCity(all);
  const t = m.waitlist;

  return (
    <>
      <div className="title-row">
        <div><h1>{t.title}</h1><p className="muted">{t.subtitle}</p></div>
        <a className="btn" href="/waitlist/export">{t.export}</a>
      </div>
      <p className="muted small">{t.caslNote}</p>

      {all.length === 0 ? <p className="empty">{t.empty}</p> : (
        <>
          <section className="card">
            <h2>{t.demand}</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>{t.demandCols.city}</th><th>{t.demandCols.owners}</th><th>{t.demandCols.carers}</th><th>{t.demandCols.total}</th><th>{t.demandCols.pending}</th><th /></tr></thead>
                <tbody>
                  {demand.map((d) => (
                    <tr key={d.key}>
                      <td>{typeof d.label === "string" ? fill(t.other, { name: d.label }) : pick(d.label)}</td>
                      <td>{d.owners}</td><td>{d.carers}</td><td><strong>{d.total}</strong></td><td>{d.pending}</td>
                      <td>
                        {d.pending > 0 ? (
                          <form action={markContactedAction}>
                            <input type="hidden" name="cityId" value={d.city_id ?? ""} />
                            <input type="hidden" name="other" value={typeof d.label === "string" ? d.label : ""} />
                            <button className="btn btn-ghost">{t.markCity}</button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <h2 style={{ marginBlockStart: 32 }}>{t.entries}</h2>
          <div className="tabs" role="tablist">
            {(["all", "pending"] as const).map((f) => (
              <Link key={f} href={`/waitlist?filter=${f}`} className={f === filter ? "tab tab-on" : "tab"} role="tab" aria-selected={f === filter}>{t.filters[f]}</Link>
            ))}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr>{(["email", "city", "interest", "language", "joined", "status"] as const).map((c) => <th key={c}>{t.cols[c]}</th>)}<th /></tr></thead>
              <tbody>
                {rows.map((w) => (
                  <tr key={w.id}>
                    <td dir="ltr" className="start">{w.email}</td>
                    <td>{w.city_id ? pick(w.city_name) : fill(t.other, { name: w.requested_city ?? "" })}</td>
                    <td>{t.interest[w.interest]}</td>
                    <td>{(w.language ?? "—").toUpperCase()}</td>
                    <td>{date(w.created_at)}</td>
                    <td>{w.notified_at ? <span className="chip chip-approved">{fill(t.contacted, { date: date(w.notified_at) })}</span> : <span className="muted small">{t.notContacted}</span>}</td>
                    <td>
                      <form action={deleteWaitlistAction}>
                        <input type="hidden" name="id" value={w.id} />
                        <button className="link-button" title={t.deleteHelp}>{t.delete}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
