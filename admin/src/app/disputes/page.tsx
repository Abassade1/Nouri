import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";
import { listDisputes, type DisputeFilter } from "@/lib/ops";

const FILTERS: DisputeFilter[] = ["open", "resolved"];

export default async function Disputes({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireAdmin();
  const { m, pick, date, dateTime, money } = await getI18n();
  const { filter: raw } = await searchParams;
  const filter: DisputeFilter = raw === "resolved" ? "resolved" : "open";
  const rows = await listDisputes(filter);

  return (
    <>
      <h1>{m.disputes.title}</h1>
      <p className="muted">{m.disputes.subtitle}</p>

      <div className="tabs" role="tablist">
        {FILTERS.map((f) => (
          <Link key={f} href={`/disputes?filter=${f}`} className={f === filter ? "tab tab-on" : "tab"} role="tab" aria-selected={f === filter}>
            {m.disputes.filters[f]}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? <p className="empty">{m.disputes.empty}</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{m.disputes.cols.visit}</th><th>{m.disputes.cols.owner}</th><th>{m.disputes.cols.carer}</th>
                <th>{m.disputes.cols.reported}</th><th>{m.disputes.cols.total}</th><th>{m.disputes.cols.outcome}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const outcome = d.status === "disputed" ? "open" : d.status === "cancelled" ? "refunded" : "carer";
                return (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/disputes/${d.id}`} className="row-link">{pick(d.service?.name_i18n)}</Link>
                      <div className="muted small">{dateTime(d.start_at, d.timezone)}</div>
                    </td>
                    <td>{d.owner_name ?? "—"}</td>
                    <td>{d.carer_name ?? "—"}</td>
                    <td>{d.disputed_at ? date(d.disputed_at) : "—"}</td>
                    <td>{money(d.total_cents, d.currency)}</td>
                    <td><span className={`chip chip-out-${outcome}`}>{m.disputes.outcome[outcome]}</span></td>
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
