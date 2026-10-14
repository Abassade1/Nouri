import type { Messages } from "@/lib/i18n/en";
import { ICONS, RATE_UNITS, SERVICE_LANGS } from "@/lib/service-form";

type Values = { name_i18n: Record<string, string>; description_i18n: Record<string, string>; rate_unit: string; icon: string | null; sort_order: number; is_active: boolean };

/** The shared form body for creating and editing a service. */
export function ServiceFields({ m, value, unitLocked }: { m: Messages; value: Values; unitLocked: boolean }) {
  const t = m.services.detail;
  return (
    <>
      <section className="card">
        <h2>{t.names}</h2>
        <p className="muted small">{t.englishRequired}</p>
        <div className="grid2">
          {SERVICE_LANGS.map((l) => (
            <label key={l} className="field"><span>{l.toUpperCase()}{l === "en" ? " *" : ""}</span>
              <input name={`name_${l}`} defaultValue={value.name_i18n[l] ?? ""} required={l === "en"} maxLength={80} dir="auto" />
            </label>
          ))}
        </div>
        <h3>{t.descriptions}</h3>
        <div className="grid2">
          {SERVICE_LANGS.map((l) => (
            <label key={l} className="field"><span>{l.toUpperCase()}{l === "en" ? " *" : ""}</span>
              <textarea name={`desc_${l}`} defaultValue={value.description_i18n[l] ?? ""} required={l === "en"} maxLength={300} rows={3} dir="auto" />
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>{t.billing}</h2>
        <div className="grid2">
          <label className="field"><span>{t.unit}</span>
            <select name="unit" defaultValue={value.rate_unit} disabled={unitLocked}>
              {RATE_UNITS.map((u) => <option key={u} value={u}>{m.unit[u]}</option>)}
            </select>
            {unitLocked ? <small className="muted">{t.unitLocked}</small> : null}
          </label>
          <label className="field"><span>{t.order}</span>
            <input name="order" defaultValue={value.sort_order} inputMode="numeric" dir="ltr" />
            <small className="muted">{t.orderHelp}</small>
          </label>
          <label className="field"><span>{t.icon}</span>
            <select name="icon" defaultValue={value.icon ?? ""}>
              <option value="">{t.noIcon}</option>
              {ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="card">
        <h2>{t.availability}</h2>
        <label className="check live-switch"><input type="checkbox" name="active" defaultChecked={value.is_active} />
          <span><strong>{t.activeLabel}</strong><br /><span className="muted small">{t.activeHelp}</span></span>
        </label>
      </section>
    </>
  );
}
