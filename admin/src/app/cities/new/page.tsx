import Link from "next/link";

import { createCityAction } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { languagesEnabled } from "@/lib/cities";
import { getI18n } from "@/lib/i18n";

export default async function NewCity({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { m } = await getI18n();
  const { error } = await searchParams;
  const langs = await languagesEnabled();
  const t = m.cities.newCity;
  const errorText = error ? (m.errors[error as keyof typeof m.errors] ?? m.errors.generic) : null;

  return (
    <>
      <Link href="/cities" className="back">← {m.cities.detail.back}</Link>
      <h1>{t.title}</h1>
      <p className="muted">{t.intro}</p>
      {errorText ? <p className="error" role="alert">{errorText}</p> : null}
      <form action={createCityAction} className="card stack">
        <div className="grid2">
          {(["en", "fr", "ar"] as const).map((l) => (
            <label key={l} className="field"><span>{m.cities.detail.names} ({l.toUpperCase()}){l === "en" ? " *" : ""}</span><input name={`name_${l}`} required={l === "en"} dir="auto" /></label>
          ))}
          <label className="field"><span>{t.slug}</span><input name="slug" required dir="ltr" placeholder="edmonton" /><small className="muted">{t.slugHelp}</small></label>
          <label className="field"><span>{t.country}</span><input name="country" required maxLength={2} dir="ltr" placeholder="CA" /><small className="muted">{t.countryHelp}</small></label>
          <label className="field"><span>{t.region}</span><input name="region" required dir="auto" placeholder="AB" /></label>
          <label className="field"><span>{t.timezone}</span><input name="timezone" required dir="ltr" placeholder="America/Edmonton" /><small className="muted">{t.timezoneHelp}</small></label>
          <label className="field"><span>{t.currency}</span><input name="currency" required maxLength={3} dir="ltr" placeholder="CAD" /><small className="muted">{t.currencyHelp}</small></label>
          <label className="field"><span>{t.defaultLanguage}</span>
            <select name="defaultLanguage" defaultValue="en">{langs.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}</select>
          </label>
        </div>
        <button className="btn btn-primary">{t.create}</button>
      </form>
    </>
  );
}
