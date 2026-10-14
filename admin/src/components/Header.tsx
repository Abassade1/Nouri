import Link from "next/link";

import { setLanguage, signOut } from "@/app/actions";
import { getI18n, LOCALES, LOCALE_NAMES } from "@/lib/i18n";
import { opsCounts } from "@/lib/ops";
import { PREVIEW } from "@/lib/preview";

export async function Header() {
  const { m, locale } = await getI18n();
  // Counts for the badges; a signed-out visitor (login page) simply has none.
  const counts = await opsCounts().catch(() => ({ disputes: 0, urgentFlags: 0 }));
  return (
    <>
      {PREVIEW ? <div className="banner">{m.previewBanner}</div> : null}
      <header className="header">
        <div className="header-inner">
          <Link href="/applications" className="brand">
            <span className="brand-name">{m.brand}</span>
            <span className="brand-sub">{m.brandSub}</span>
          </Link>
          <nav className="nav">
            <Link href="/applications">{m.nav.applications}</Link>
            <Link href="/disputes">{m.nav.disputes}{counts.disputes > 0 ? <span className="count">{counts.disputes}</span> : null}</Link>
            <Link href="/payments">{m.nav.payments}</Link>
            <Link href="/cities">{m.nav.cities}</Link>
            <Link href="/services">{m.nav.services}</Link>
            <Link href="/waitlist">{m.nav.waitlist}</Link>
            <Link href="/flags">{m.nav.flags}{counts.urgentFlags > 0 ? <span className="count count-alert">{counts.urgentFlags}</span> : null}</Link>
          </nav>
          <div className="header-end">
            <form action={setLanguage} className="lang" aria-label={m.language}>
              {LOCALES.map((l) => (
                <button key={l} name="lang" value={l} className={l === locale ? "lang-on" : ""} aria-pressed={l === locale}>
                  {LOCALE_NAMES[l]}
                </button>
              ))}
            </form>
            <form action={signOut}>
              <button className="link-button">{m.signOut}</button>
            </form>
          </div>
        </div>
      </header>
    </>
  );
}
