import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { getPayments, type Range } from "@/lib/finance";
import { getI18n } from "@/lib/i18n";

const RANGES: Range[] = ["d30", "d90", "all"];

export default async function Payments({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireAdmin();
  const { m, pick, date, dateTime, money } = await getI18n();
  const { range: raw } = await searchParams;
  const range: Range = (RANGES as string[]).includes(raw ?? "") ? (raw as Range) : "d30";
  const view = await getPayments(range);
  const t = m.payments;
  const nothingWrong = view.failed === 0 && view.overdue.length === 0 && view.openDisputes === 0;

  return (
    <>
      <h1>{t.title}</h1>
      <p className="muted">{t.subtitle}</p>

      <div className="tabs" role="tablist">
        {RANGES.map((r) => (
          <Link key={r} href={`/payments?range=${r}`} className={r === range ? "tab tab-on" : "tab"} role="tab" aria-selected={r === range}>{t.ranges[r]}</Link>
        ))}
      </div>

      <section className="card">
        <h2>{t.attention.title}</h2>
        {nothingWrong ? <p className="muted">{t.attention.none}</p> : (
          <ul className="plain">
            {view.openDisputes > 0 ? <li className="split"><span>{t.attention.disputes}</span><Link href="/disputes"><strong>{view.openDisputes}</strong> →</Link></li> : null}
            {view.failed > 0 ? <li><div className="split"><span>{t.attention.failed}</span><strong>{view.failed}</strong></div><p className="muted small">{t.attention.failedHelp}</p></li> : null}
            {view.overdue.length > 0 ? <li><div className="split"><span className="alert-text">{t.attention.overdue}</span><strong className="alert-text">{view.overdue.length}</strong></div><p className="muted small">{t.attention.overdueHelp}</p></li> : null}
          </ul>
        )}
      </section>

      {view.summaries.length === 0 ? <p className="empty">{t.noData}</p> : view.summaries.map((s) => (
        <section key={s.currency} className="card">
          <h2>{s.currency}</h2>
          <div className="kpis">
            {([
              ["charged", s.charged, null], ["refunded", s.refunded, null], ["net", s.net, null],
              ["commission", s.commission, t.help.commission], ["tax", s.tax, t.help.tax],
              ["paidOut", s.paidOut, null], ["owed", s.owed, t.help.owed], ["held", s.held, t.help.held],
            ] as const).map(([key, cents, help]) => (
              <div key={key} className="kpi">
                <div className="muted small">{t.cards[key]}</div>
                <div className="kpi-value">{money(cents, s.currency)}</div>
                {help ? <div className="muted small">{help}</div> : null}
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="card">
        <div className="split">
          <h2>{t.table.title}</h2>
          <a className="btn" href={`/payments/export?range=${range}`}>{t.export}</a>
        </div>
        {view.rows.length === 0 ? <p className="muted">{t.table.empty}</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>{(["date", "visit", "owner", "carer", "total", "refunded", "state"] as const).map((c) => <th key={c}>{t.table.cols[c]}</th>)}</tr>
              </thead>
              <tbody>
                {view.rows.slice(0, 100).map((r) => (
                  <tr key={r.id} className={view.overdue.some((o) => o.id === r.id) ? "row-alert" : undefined}>
                    <td>{r.paid_at ? date(r.paid_at) : "—"}</td>
                    <td>{pick(r.service?.name_i18n)}<div className="muted small">{dateTime(r.start_at, r.timezone)}</div></td>
                    <td>{r.owner_name ?? "—"}</td>
                    <td>{r.carer_name ?? "—"}</td>
                    <td>{money(r.total_cents, r.currency)}</td>
                    <td>{r.refunded_cents ? money(r.refunded_cents, r.currency) : "—"}</td>
                    <td><span className={`chip chip-pay-${r.state}`}>{t.state[r.state]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small">{t.note}</p>
      </section>
    </>
  );
}
