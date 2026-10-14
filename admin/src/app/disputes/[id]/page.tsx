import Link from "next/link";
import { notFound } from "next/navigation";

import { decideDispute } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";
import { getDispute } from "@/lib/ops";

export default async function DisputeDetail({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { error } = await searchParams;
  const d = await getDispute(id);
  if (!d) notFound();

  const { m, fill, pick, date, dateTime, money } = await getI18n();
  const t = m.disputes.detail;
  const errorText = error ? (m.errors[error as keyof typeof m.errors] ?? m.errors.generic) : null;
  const open = d.status === "disputed";
  const outcome = open ? "open" : d.status === "cancelled" ? "refunded" : "carer";
  const platformShare = d.commission_cents + d.tax_cents;

  return (
    <>
      <Link href="/disputes" className="back">← {t.back}</Link>
      <div className="title-row">
        <div>
          <h1>{pick(d.service?.name_i18n)}</h1>
          <p className="muted small">{d.disputed_at ? fill(t.reported, { date: date(d.disputed_at) }) : ""}</p>
        </div>
        <span className={`chip chip-out-${outcome}`}>{m.disputes.outcome[outcome]}</span>
      </div>
      {errorText ? <p className="error" role="alert">{errorText}</p> : null}

      <section className="card">
        <h2>{t.whatOwnerSaid}</h2>
        <blockquote className="quote" dir="auto">{d.dispute_reason}</blockquote>
      </section>

      <section className="card">
        <h2>{t.visit}</h2>
        <dl className="facts">
          <dt>{t.when}</dt><dd>{dateTime(d.start_at, d.timezone)}</dd>
          <dt>{t.owner}</dt><dd>{d.owner_name ?? "—"}</dd>
          <dt>{t.carer}</dt><dd>{d.carer_name ?? "—"}</dd>
          <dt>{t.pets}</dt><dd>{d.pets.join(", ") || "—"}</dd>
        </dl>
      </section>

      <section className="card">
        <h2>{t.money}</h2>
        <dl className="facts">
          <dt>{t.total}</dt><dd>{money(d.total_cents, d.currency)} · {d.paid_at ? fill(t.paid, { date: date(d.paid_at) }) : t.notPaid}</dd>
          <dt>{t.payout}</dt><dd>{money(d.carer_payout_cents, d.currency)} · {d.transferred_at ? t.payoutSent : t.payoutHeld}</dd>
          <dt>{t.platform}</dt><dd>{money(platformShare, d.currency)}</dd>
        </dl>
      </section>

      <section className="card">
        <h2>{t.reports}</h2>
        {d.reports.length === 0 ? <p className="muted">{t.noReports}</p> : d.reports.map((r) => (
          <article key={r.id} className="credential">
            <div className="muted small">{dateTime(r.created_at, d.timezone)}</div>
            {r.summary ? <p dir="auto">{r.summary}</p> : null}
            <div className="chips">{Object.entries(r.checklist).filter(([, v]) => v).map(([k]) => <span key={k} className="chip">{k.replace(/_/g, " ")}</span>)}</div>
            {r.photo_urls.length ? <div className="photos">{r.photo_urls.map((u) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={u} src={u} alt="" />)}</div> : null}
          </article>
        ))}
      </section>

      <section className="card">
        <h2>{t.concerns}</h2>
        {d.flags.length === 0 ? <p className="muted">{t.noConcerns}</p> : (
          <ul className="plain">
            {d.flags.map((f) => (
              <li key={f.id} className="split">
                <span dir="auto">{f.notes}</span>
                <Link href={`/flags/${f.id}`}>{t.openFlag}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>{t.decision}</h2>
        {open ? (
          <>
            <p className="muted small">{t.decisionHelp}</p>
            <form action={decideDispute} className="stack">
              <input type="hidden" name="bookingId" value={d.id} />
              <label className="field">
                <span>{t.note}</span>
                <textarea name="note" rows={4} placeholder={t.notePlaceholder} required />
              </label>
              <div className="choice">
                <button name="decision" value="carer" className="btn btn-primary">{t.sideCarer}</button>
                <p className="muted small">{t.sideCarerHelp}</p>
              </div>
              <div className="choice">
                <label className="check">
                  <input type="checkbox" name="confirm" />
                  <span>{fill(t.refundHelp, { amount: money(d.total_cents, d.currency) })}</span>
                </label>
                <button name="decision" value="refund" className="btn btn-danger">{t.refund}</button>
              </div>
            </form>
          </>
        ) : (
          <dl className="facts">
            <dt>{t.outcomeLabel}</dt><dd>{m.disputes.outcome[outcome]}</dd>
            <dt>{t.noteLabel}</dt><dd dir="auto">{d.dispute_resolution}</dd>
          </dl>
        )}
      </section>
    </>
  );
}
