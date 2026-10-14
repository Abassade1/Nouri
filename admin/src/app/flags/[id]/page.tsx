import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";
import { getFlag, hoursWithoutResponse } from "@/lib/ops";

export default async function FlagDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const f = await getFlag(id);
  if (!f) notFound();

  const { m, fill, dateTime } = await getI18n();
  const t = m.flags.detail;
  const waiting = hoursWithoutResponse(f);

  return (
    <>
      <Link href="/flags" className="back">← {t.back}</Link>
      <div className="title-row">
        <div>
          <h1 dir="auto">{f.pet_name}</h1>
          <p className="muted small">{fill(t.raised, { date: dateTime(f.created_at) })}</p>
        </div>
        <div className="chips">
          <span className={`chip chip-sev-${f.severity}`}>{m.flags.severity[f.severity]}</span>
          <span className="chip">{m.flags.category[f.category]}</span>
        </div>
      </div>

      <section className="card">
        <dl className="facts">
          <dt>{t.carer}</dt><dd>{f.carer_name ?? "—"}</dd>
          <dt>{t.owner}</dt><dd>{f.owner_name ?? "—"}</dd>
        </dl>
      </section>

      <section className="card">
        <h2>{t.notes}</h2>
        <blockquote className="quote" dir="auto">{f.notes}</blockquote>
        {f.photo_urls.length ? <div className="photos">{f.photo_urls.map((u) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={u} src={u} alt="" />)}</div> : null}
      </section>

      <section className="card">
        <h2>{t.actions}</h2>
        {f.actions.length === 0 ? (
          <p className={f.severity === "urgent" ? "alert-text" : "muted"}>
            {t.noActions}{waiting !== null && waiting >= 1 ? ` (${fill(m.flags.response.waiting, { hours: String(waiting) })})` : ""}
          </p>
        ) : (
          <ul className="plain">
            {f.actions.map((a) => (
              <li key={a.id} className="split">
                <strong>{m.flags.response[a.action as keyof typeof m.flags.response] ?? a.action}</strong>
                <span className="muted small">{dateTime(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p><Link href={`/disputes/${f.booking_id}`}>{t.visit} →</Link></p>
    </>
  );
}
