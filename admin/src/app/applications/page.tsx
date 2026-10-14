import Link from "next/link";

import { listApplications, type QueueFilter } from "@/lib/data";
import { requireAdmin } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";

const FILTERS: QueueFilter[] = ["pending", "rejected", "approved", "all"];

export default async function Applications({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireAdmin();
  const { m, pick, date } = await getI18n();
  const { filter: raw } = await searchParams;
  const filter = (FILTERS as string[]).includes(raw ?? "") ? (raw as QueueFilter) : "pending";
  const rows = await listApplications(filter);

  return (
    <>
      <h1>{m.queue.title}</h1>
      <p className="muted">{m.queue.subtitle}</p>

      <div className="tabs" role="tablist">
        {FILTERS.map((f) => (
          <Link key={f} href={`/applications?filter=${f}`} className={f === filter ? "tab tab-on" : "tab"} role="tab" aria-selected={f === filter}>
            {m.queue.filters[f]}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="empty">{m.queue.empty}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{m.queue.cols.name}</th>
                <th>{m.queue.cols.city}</th>
                <th>{m.queue.cols.submitted}</th>
                <th>{m.queue.cols.credentials}</th>
                <th>{m.queue.cols.status}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const verified = a.credentials.filter((c) => c.status === "verified").length;
                return (
                  <tr key={a.user_id}>
                    <td>
                      <Link href={`/applications/${a.user_id}`} className="row-link">{a.display_name}</Link>
                      {a.headline ? <div className="muted small">{a.headline}</div> : null}
                    </td>
                    <td>{pick(a.cities?.name_i18n)}</td>
                    <td>{a.submitted_at ? date(a.submitted_at) : "—"}</td>
                    <td>{verified} / {a.credentials.length}</td>
                    <td><span className={`chip chip-${a.status}`}>{m.status[a.status]}</span></td>
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
