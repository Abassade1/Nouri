import { redirect } from "next/navigation";

import { signIn } from "@/app/actions";
import { getI18n } from "@/lib/i18n";
import { PREVIEW } from "@/lib/preview";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (PREVIEW) redirect("/applications");
  const { m } = await getI18n();
  const { error } = await searchParams;
  return (
    <div className="narrow">
      <h1>{m.login.title}</h1>
      <p className="muted">{m.login.subtitle}</p>
      <form action={signIn} className="stack">
        <label className="field">
          <span>{m.login.email}</span>
          <input name="email" type="email" required autoComplete="email" dir="ltr" />
        </label>
        <label className="field">
          <span>{m.login.password}</span>
          <input name="password" type="password" required autoComplete="current-password" dir="ltr" />
        </label>
        {error ? <p className="error" role="alert">{error === "notAdmin" ? m.login.notAdmin : m.login.invalid}</p> : null}
        <button className="btn btn-primary">{m.login.submit}</button>
      </form>
    </div>
  );
}
