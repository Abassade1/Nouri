import Link from "next/link";

import { createServiceAction } from "@/app/actions";
import { ServiceFields } from "@/components/ServiceFields";
import { requireAdmin } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";

export default async function NewService({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { m } = await getI18n();
  const { error } = await searchParams;
  const t = m.services.newService;
  const errorText = error ? (m.errors[error as keyof typeof m.errors] ?? m.errors.generic) : null;

  return (
    <>
      <Link href="/services" className="back">← {m.services.detail.back}</Link>
      <h1>{t.title}</h1>
      <p className="muted">{t.intro}</p>
      {errorText ? <p className="error" role="alert">{errorText}</p> : null}
      <form action={createServiceAction} className="stack">
        <section className="card">
          <label className="field"><span>{t.slug}</span><input name="slug" required dir="ltr" placeholder="nail_trim" maxLength={40} /><small className="muted">{t.slugHelp}</small></label>
        </section>
        <ServiceFields m={m} unitLocked={false} value={{ name_i18n: {}, description_i18n: {}, rate_unit: "per_visit", icon: null, sort_order: 10, is_active: true }} />
        <div><button className="btn btn-primary">{t.create}</button></div>
      </form>
    </>
  );
}
