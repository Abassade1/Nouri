import Link from "next/link";
import { notFound } from "next/navigation";

import { decideApplication, reviewCredential } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { documentUrl, getApplication, getFullName } from "@/lib/data";
import { getI18n } from "@/lib/i18n";

export default async function ApplicationDetail({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { error } = await searchParams;
  const app = await getApplication(id);
  if (!app) notFound();

  const { m, fill, pick, date, money } = await getI18n();
  const fullName = await getFullName(id);
  const currency = app.cities?.currency ?? "CAD";
  const inReview = app.status === "pending";
  const errorText = error ? (m.errors[error as keyof typeof m.errors] ?? m.errors.generic) : null;
  const urls = await Promise.all(app.credentials.map((c) => documentUrl(c.file_path)));
  const listOf = (codes: string[]) => (codes.length ? codes.join(", ") : "—");

  return (
    <>
      <Link href="/applications" className="back">← {m.detail.back}</Link>
      <div className="title-row">
        <div>
          <h1>{app.display_name}</h1>
          {fullName && fullName !== app.display_name ? <p className="muted">{fullName}</p> : null}
        </div>
        <span className={`chip chip-${app.status}`}>{m.status[app.status]}</span>
      </div>
      <p className="muted small">
        {pick(app.cities?.name_i18n)}
        {app.submitted_at ? ` · ${fill(m.detail.submitted, { date: date(app.submitted_at) })}` : ""}
      </p>
      {errorText ? <p className="error" role="alert">{errorText}</p> : null}

      <section className="card">
        <h2>{m.detail.about}</h2>
        <dl className="facts">
          {app.headline ? (<><dt>{m.detail.headline}</dt><dd>{app.headline}</dd></>) : null}
          <dt>{m.detail.bio}</dt><dd>{app.bio}</dd>
          <dt>{m.detail.years}</dt><dd>{app.years_experience ?? "—"}</dd>
          <dt>{m.detail.languages}</dt><dd>{listOf(app.languages_spoken)}</dd>
          <dt>{m.detail.specialties}</dt><dd>{listOf(app.specialties.map((s) => s.replace(/_/g, " ")))}</dd>
          <dt>{m.detail.radius}</dt><dd><bdi dir="ltr">{app.service_radius_km} km</bdi></dd>
          <dt>{m.detail.postal}</dt><dd><bdi dir="ltr">{app.postal_code ?? "—"}</bdi></dd>
        </dl>
      </section>

      <section className="card">
        <h2>{m.detail.consent}</h2>
        <dl className="facts">
          <dt>{m.detail.backgroundConsent}</dt>
          <dd>{app.background_check_consent_at ? fill(m.detail.givenOn, { date: date(app.background_check_consent_at) }) : m.detail.notGiven}</dd>
          <dt>{m.detail.termsAccepted}</dt>
          <dd>{app.terms_accepted_at ? fill(m.detail.givenOn, { date: date(app.terms_accepted_at) }) : m.detail.notGiven}</dd>
        </dl>
      </section>

      <section className="card">
        <h2>{m.detail.services}</h2>
        {app.carer_services.length === 0 ? <p className="muted">{m.detail.none}</p> : (
          <ul className="plain">
            {app.carer_services.map((s, i) => (
              <li key={i} className="split">
                <span>{pick(s.services?.name_i18n)}</span>
                <span>{money(s.rate_cents, currency)} <span className="muted small">{s.services ? m.unit[s.services.rate_unit as keyof typeof m.unit] : ""}</span></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>{m.detail.credentials}</h2>
        {app.credentials.length === 0 ? <p className="muted">{m.detail.none}</p> : app.credentials.map((c, i) => (
          <article key={c.id} className="credential">
            <div className="split">
              <div>
                <strong>{c.title}</strong>
                <div className="muted small">
                  {m.credType[c.type as keyof typeof m.credType]}
                  {c.issuer ? ` · ${m.detail.issuedBy} ${c.issuer}` : ""}
                  {" · "}{c.expires_on ? fill(m.detail.expires, { date: date(c.expires_on) }) : m.detail.noExpiry}
                </div>
              </div>
              <span className={`chip chip-cred-${c.status}`}>{m.credStatus[c.status]}</span>
            </div>
            {urls[i] ? <a href={urls[i]!} target="_blank" rel="noreferrer" className="doc-link">{m.detail.openDocument} ↗</a> : null}
            {c.review_notes ? <p className="small"><span className="muted">{m.detail.reviewedNote}:</span> {c.review_notes}</p> : null}
            <form action={reviewCredential} className="review-form">
              <input type="hidden" name="credentialId" value={c.id} />
              <input type="hidden" name="carerId" value={app.user_id} />
              <input name="notes" placeholder={m.detail.notes} defaultValue={c.review_notes ?? ""} aria-label={m.detail.notes} />
              <div className="btn-row">
                <button name="status" value="verified" className="btn btn-primary" disabled={c.status === "verified"}>{m.detail.verify}</button>
                <button name="status" value="rejected" className="btn" disabled={c.status === "rejected"}>{m.detail.reject}</button>
                {c.status !== "pending" ? <button name="status" value="pending" className="btn btn-ghost">{m.detail.reopen}</button> : null}
              </div>
            </form>
          </article>
        ))}
      </section>

      <section className="card">
        <h2>{m.detail.references}</h2>
        {app.carer_references.length === 0 ? <p className="muted">{m.detail.none}</p> : (
          <ul className="plain">
            {app.carer_references.map((r) => (
              <li key={r.id}>
                <strong>{r.name}</strong>{r.relationship ? <span className="muted"> · {r.relationship}</span> : null}
                <div className="small muted">{[r.email, r.phone].filter(Boolean).map((v, i) => (<span key={i}>{i ? "  ·  " : ""}<bdi dir="ltr">{v}</bdi></span>))}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>{m.detail.decision}</h2>
        {inReview ? (
          <>
            <p className="muted small">{m.detail.decisionHelp}</p>
            <form action={decideApplication} className="stack">
              <input type="hidden" name="carerId" value={app.user_id} />
              <label className="field">
                <span>{m.detail.reasonLabel}</span>
                <textarea name="reason" rows={3} placeholder={m.detail.reasonHint} />
              </label>
              <div className="btn-row">
                <button name="decision" value="approved" className="btn btn-primary">{m.detail.approve}</button>
                <button name="decision" value="rejected" className="btn">{m.detail.returnWithNotes}</button>
              </div>
            </form>
          </>
        ) : (
          <>
            <p className="muted">{m.detail.notInReview}</p>
            {app.rejection_reason ? <p><span className="muted small">{m.detail.reasonLabel}:</span> {app.rejection_reason}</p> : null}
            {app.reviewed_at ? <p className="muted small">{fill(m.detail.decided, { date: date(app.reviewed_at) })}</p> : null}
          </>
        )}
      </section>
    </>
  );
}
