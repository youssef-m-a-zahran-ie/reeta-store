/** One piece of copy in both languages, side by side. Field names end in _en and _ar. */
export function Bilingual({
  name,
  label,
  en,
  ar,
  long,
  rows = 3,
}: {
  name: string;
  label: string;
  en: string;
  ar: string;
  long?: boolean;
  rows?: number;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="label">{label}</span>
      <div className="grid gap-2 md:grid-cols-2">
        {long ? (
          <>
            <textarea className="input" name={`${name}_en`} defaultValue={en} rows={rows} aria-label={`${label} (English)`} placeholder="English" />
            <textarea className="input" name={`${name}_ar`} defaultValue={ar} rows={rows} dir="rtl" aria-label={`${label} (Arabic)`} placeholder="عربي" />
          </>
        ) : (
          <>
            <input className="input" name={`${name}_en`} defaultValue={en} aria-label={`${label} (English)`} placeholder="English" />
            <input className="input" name={`${name}_ar`} defaultValue={ar} dir="rtl" aria-label={`${label} (Arabic)`} placeholder="عربي" />
          </>
        )}
      </div>
    </div>
  );
}
