import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";
import { hoursWithoutResponse, isResolved, listFlags, type FlagFilter } from "@/lib/ops";

const FILTERS: FlagFilter[] = ["attention", "urgent", "resolved", "all"];

export default async function Flags({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireAdmin();
  const { m, fill, dateTime } = await getI18n();
  const { filter: raw } = await searchParams;
  const filter = (FILTERS as string[]).includes(raw ?? "") ? (raw as FlagFilter) : "attention";
  const rows = await listFlags(filter);

  return (
    <>
      <h1>{m.flags.title}</h1>
      <p className="muted">{m.flags.subtitle}</p>

      <div className="tabs" role="tablist">
        {FILTERS.map((f) => (
          <Link key={f} href={`/flags?filter=${f}`} className={f === filter ? "tab tab-on" : "tab"} role="tab" aria-selected={f === filter}>
            {m.flags.filters[f]}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? <p className="empty">{m.flags.empty}</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{m.flags.cols.pet}</th><th>{m.flags.cols.severity}</th><th>{m.flags.cols.carer}</th>
                <th>{m.flags.cols.owner}</th><th>{m.flags.cols.raised}</th><th>{m.flags.cols.response}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => {
                const waiting = hoursWithoutResponse(f);
                const last = f.actions[f.actions.length - 1];
                const stale = waiting !== null && f.severity === "urgent" && !isResolved(f);
                return (
                  <tr key={f.id} className={stale ? "row-alert" : undefined}>
                    <td>
                      <Link href={`/flags/${f.id}`} className="row-link" dir="auto">{f.pet_name}</Link>
                      <div className="muted small">{m.flags.category[f.category]}</div>
                    </td>
                    <td><span className={`chip chip-sev-${f.severity}`}>{m.flags.severity[f.severity]}</span></td>
                    <td>{f.carer_name ?? "—"}</td>
                    <td>{f.owner_name ?? "—"}</td>
                    <td>{dateTime(f.created_at)}</td>
                    <td>
                      {waiting !== null
                        ? <span className={stale ? "alert-text" : "muted"}>{waiting >= 1 ? fill(m.flags.response.waiting, { hours: String(waiting) }) : m.flags.response.none}</span>
                        : m.flags.response[last.action as keyof typeof m.flags.response] ?? last.action}
                    </td>
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
