'use client';

import { useMemo, useRef, useState } from 'react';
import {
  X, FileSpreadsheet, Download, Upload, Loader2, AlertTriangle, CheckCircle2, UserPlus, UserCheck, HelpCircle, Info, ArrowRight,
} from 'lucide-react';
import type { Donation, Donor } from '@/types/donor';
import { useAuth } from '@/components/AuthContext';
import { toast } from '@/components/Toaster';
import { donorDisplayName } from '@/lib/import/donorMatch';
import { DONOR_COLUMNS, SHEET_NAMES } from '@/lib/import/excelColumns';
import { downloadTemplate, readExcelFile } from '@/lib/import/excelFile';
import {
  buildPlan,
  displayValue,
  isTempId,
  planRows,
  targetOf,
  type PlannedRow,
  type RowChoice,
} from '@/lib/import/excelPlan';
import { executeImport, type ExecuteResult } from '@/lib/import/excelImport';
import { formatAmount } from '@/components/donations/donationUtils';

type Props = {
  donors: Donor[];
  donations: Donation[];
  onClose: () => void;
  /** אחרי ייבוא – רענון התורמים והתרומות */
  onImported: () => void;
};

type Step = 'upload' | 'review' | 'running' | 'done';

const MAX_TABLE_ROWS = 500;

const fieldLabel = (f: string) => DONOR_COLUMNS.find((c) => c.field === f)?.header ?? f;

const rowLabel = (p: PlannedRow) => `${SHEET_NAMES[p.row.sheet]} · שורה ${p.row.rowNumber}`;

const incomingName = (p: PlannedRow) =>
  [p.donor.first_name_he, p.donor.last_name_he].filter(Boolean).join(' ') ||
  [p.donor.first_name_en, p.donor.last_name_en].filter(Boolean).join(' ') ||
  '(ללא שם)';

const incomingDetails = (p: PlannedRow) =>
  [p.donor.zeout && `ת"ז ${p.donor.zeout}`, p.donor.phone_1, p.donor.email, p.donor.city].filter(Boolean).join(' · ');

/** ייבוא תורמים ותרומות מאקסל: תבנית → העלאה → בדיקה והחלטות → ייבוא */
export default function ImportExcelModal({ donors, donations, onClose, onImported }: Props) {
  const { hasPermission, user } = useAuth();
  const canViewContact = hasPermission('donors_view_contact');
  const canViewAmount = hasPermission('donations_view_amount');

  const [step, setStep] = useState<Step>('upload');
  const [reading, setReading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [notices, setNotices] = useState<string[]>([]);
  const [planned, setPlanned] = useState<PlannedRow[]>([]);
  const [choices, setChoices] = useState<Record<string, RowChoice>>({});
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const [showFills, setShowFills] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const donorById = useMemo(() => new Map(donors.map((d) => [d.id, d])), [donors]);
  const plan = useMemo(() => buildPlan(planned, choices, donors, donations), [planned, choices, donors, donations]);
  const chooseRows = useMemo(() => planned.filter((p) => p.match.kind === 'choose'), [planned]);
  const allConflicts = plan.updates.flatMap((u) => u.conflicts.map((c) => ({ ...c, donorName: u.name })));
  const fillUpdates = plan.updates.filter((u) => Object.keys(u.fills).length > 0);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setReading(true);
    try {
      const read = await readExcelFile(file);
      setFileName(file.name);
      setNotices(read.notices);
      setPlanned(planRows(read.rows, donors));
      setChoices({});
      setAccepted(new Set());
      if (read.rows.length) setStep('review');
      else toast.warning(read.notices[0] ?? 'לא נמצאו שורות לייבוא');
    } catch (e) {
      toast.error(`לא הצלחנו לקרוא את הקובץ: ${e instanceof Error ? e.message : 'שגיאה'}`);
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function runImport() {
    const total = plan.newDonors.size + plan.updates.length + plan.donations.length;
    if (total === 0) return toast.info('אין מה לייבא');
    const parts = [
      plan.newDonors.size && `${plan.newDonors.size} תורמים חדשים`,
      plan.updates.length && `עדכון ${plan.updates.length} תורמים קיימים`,
      plan.donations.length && `${plan.donations.length} תרומות`,
    ].filter(Boolean);
    const skipped = plan.undecided.length + plan.errors.length + plan.skipped.length;
    if (!window.confirm(`לייבא עכשיו: ${parts.join(', ')}?${skipped ? `\n\n${skipped} שורות לא ייובאו (שגיאות / לא נבחר תורם / דלג).` : ''}`)) return;

    setStep('running');
    try {
      const r = await executeImport(plan, {
        donors,
        acceptedConflicts: accepted,
        canCreateDonors: hasPermission('donors_create'),
        canEditDonors: hasPermission('donors_edit'),
        canCreateDonations: hasPermission('donations_create'),
        userId: user?.id,
        onProgress: setProgress,
      });
      setResult(r);
      setStep('done');
      onImported();
    } catch (e) {
      toast.error(`הייבוא נכשל: ${e instanceof Error ? e.message : 'שגיאה'}`);
      setStep('review');
    }
  }

  const candidateLabel = (id: string) => {
    if (isTempId(id)) {
      const source = planned.find((p) => p.match.kind === 'new' && p.match.tempId === id);
      return source ? `תורם חדש מהקובץ: ${incomingName(source)} (${rowLabel(source)})` : 'תורם חדש מהקובץ';
    }
    const d = donorById.get(id);
    if (!d) return id;
    return [donorDisplayName(d), d.zeout && `ת"ז ${d.zeout}`, d.phone_1, d.email, d.city].filter(Boolean).join(' · ');
  };

  const statusOf = (p: PlannedRow): { text: string; tone: string } => {
    if (p.match.kind === 'error') return { text: 'שגיאה – לא ייובא', tone: 'text-red-700 bg-red-50 border-red-200' };
    if (plan.duplicates.includes(p)) return { text: 'התרומה כבר קיימת – תדולג', tone: 'text-slate-500 bg-slate-50 border-slate-200' };
    if (p.match.kind === 'choose' && !choices[p.key]) return { text: 'צריך לבחור תורם', tone: 'text-amber-800 bg-amber-50 border-amber-300' };
    const target = targetOf(p, choices);
    if (!target) return { text: 'לא ייובא (דלג)', tone: 'text-slate-500 bg-slate-50 border-slate-200' };
    if (isTempId(target)) return { text: 'תורם חדש', tone: 'text-blue-700 bg-blue-50 border-blue-200' };
    const by = p.match.kind === 'existing' ? ` (לפי ${p.match.by})` : '';
    return { text: `תורם קיים: ${donorById.get(target) ? donorDisplayName(donorById.get(target)!) : ''}${by}`, tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  };

  const sortedRows = useMemo(() => {
    const weight = (p: PlannedRow) => (p.match.kind === 'error' ? 0 : p.match.kind === 'choose' ? 1 : p.row.warnings.length ? 2 : 3);
    return [...planned].sort((a, b) => weight(a) - weight(b));
  }, [planned]);

  return (
    <div dir="rtl" className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-2 md:p-4" onClick={step === 'running' ? undefined : onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* כותרת */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            ייבוא מאקסל
            {fileName && step !== 'upload' && <span className="text-xs font-normal text-slate-400">– {fileName}</span>}
          </h2>
          {step !== 'running' && (
            <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-5">
          {!canViewContact ? (
            <div className="p-6 text-center text-red-600 font-medium">
              ייבוא מאקסל דורש הרשאה לראות פרטי התקשרות של תורמים (כדי לזהות תורמים קיימים).
            </div>
          ) : step === 'upload' ? (
            /* ===== שלב 1: תבנית והעלאה ===== */
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-2xl p-5 space-y-3">
                  <div className="font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center">1</span>
                    מורידים את התבנית
                  </div>
                  <p className="text-sm text-slate-600">
                    קובץ אקסל עם שני גיליונות למילוי – <b>תורמים</b> ו<b>תרומות</b> – וגיליון <b>הוראות</b> שמסביר כל עמודה.
                  </p>
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold"
                  >
                    <Download className="w-4 h-4" />
                    הורדת תבנית ריקה
                  </button>
                </div>

                <div className="border border-slate-200 rounded-2xl p-5 space-y-3">
                  <div className="font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">2</span>
                    מעלים את הקובץ המלא
                  </div>
                  <p className="text-sm text-slate-600">
                    לפני שנשמר משהו תוצג בדיקה של כל שורה: למי היא תשויך, מה ייווצר ומה צריך לתקן.
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => void onFile(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={reading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50"
                  >
                    {reading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    בחירת קובץ
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm text-slate-700 space-y-2">
                <div className="font-bold flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-slate-500" />
                  הוראות קצרות
                </div>
                <ul className="list-disc pr-5 space-y-1">
                  <li>שורה אחת לכל תורם (גיליון &quot;תורמים&quot;) או לכל תרומה (גיליון &quot;תרומות&quot;). לא משנים את שורת הכותרות.</li>
                  <li>
                    תורם קיים מזוהה לפי <b>ת&quot;ז</b>, אחר כך <b>טלפון</b>, אחר כך <b>מייל</b>. לא נמצא – נפתח תורם חדש. לא ברור – תבחרו בבדיקה.
                  </li>
                  <li>
                    לתורם קיים: פרטים <b>חסרים</b> נוספים אוטומטית. פרטים <b>שונים</b> מהקיים (למשל מייל חדש) – תתבקשו לאשר כל אחד.
                  </li>
                  <li>
                    בתרומות חובה: <b>סכום</b> ו<b>תאריך</b> (יום/חודש/שנה) + פרט מזהה של התורם. תרומה שכבר קיימת (אותו תורם, תאריך, סכום ומטבע) לא תיובא שוב.
                  </li>
                  <li>אפשר להעלות גם קובץ משלכם – העמודות מזוהות לפי שם הכותרת, כמו בתבנית.</li>
                </ul>
              </div>
            </div>
          ) : step === 'review' ? (
            /* ===== שלב 2: בדיקה והחלטות ===== */
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[
                  { label: 'תורמים חדשים', value: plan.newDonors.size, tone: 'text-blue-700' },
                  { label: 'תורמים קיימים יעודכנו', value: plan.updates.length, tone: 'text-emerald-700' },
                  { label: 'תרומות לייבוא', value: plan.donations.length, tone: 'text-emerald-700' },
                  { label: 'תרומות שכבר קיימות', value: plan.duplicates.length, tone: 'text-slate-500' },
                  { label: 'צריך לבחור תורם', value: plan.undecided.length, tone: plan.undecided.length ? 'text-amber-600' : 'text-slate-400' },
                  { label: 'שורות עם שגיאות', value: plan.errors.length, tone: plan.errors.length ? 'text-red-600' : 'text-slate-400' },
                ].map((c) => (
                  <div key={c.label} className="bg-white border border-slate-200 rounded-xl px-3 py-2.5">
                    <div className="text-[11px] text-slate-500">{c.label}</div>
                    <div className={`text-xl font-bold ${c.tone}`}>{c.value}</div>
                  </div>
                ))}
              </div>

              {notices.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
                  {notices.map((n) => (
                    <div key={n} className="flex gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      {n}
                    </div>
                  ))}
                </div>
              )}

              {/* שורות לא ברורות */}
              {chooseRows.length > 0 && (
                <section className="space-y-2">
                  <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-amber-600" />
                    למי לשייך? ({chooseRows.length})
                  </h3>
                  <p className="text-xs text-slate-500">שורות שלא ברור לאיזה תורם הן שייכות. שורה שלא נבחר לה תורם – לא תיובא.</p>
                  <div className="space-y-2">
                    {chooseRows.map((p) => {
                      if (p.match.kind !== 'choose') return null;
                      const value = choices[p.key] ?? '';
                      return (
                        <div
                          key={p.key}
                          className={`border rounded-xl p-3 grid grid-cols-1 md:grid-cols-2 gap-2 items-center ${value ? 'border-slate-200' : 'border-amber-300 bg-amber-50/40'}`}
                        >
                          <div className="text-sm">
                            <div className="font-medium text-slate-800">
                              {incomingName(p)} <span className="text-[11px] text-slate-400">({rowLabel(p)})</span>
                            </div>
                            <div className="text-xs text-slate-500" dir="auto">{incomingDetails(p)}</div>
                            <div className="text-[11px] text-amber-700">{p.match.reason}</div>
                          </div>
                          <select
                            value={value}
                            onChange={(e) => setChoices((c) => ({ ...c, [p.key]: e.target.value }))}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm"
                          >
                            <option value="">– לבחור –</option>
                            {p.match.candidates.map((id) => (
                              <option key={id} value={id}>
                                {candidateLabel(id)}
                              </option>
                            ))}
                            <option value="new">➕ תורם חדש</option>
                            <option value="skip">לא לייבא את השורה</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* פרטים שונים מהקיים */}
              {allConflicts.length > 0 && (
                <section className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-violet-600" />
                      פרטים שונים מהקיימים ({allConflicts.length})
                    </h3>
                    <div className="flex gap-3 text-xs">
                      <button type="button" onClick={() => setAccepted(new Set(allConflicts.map((c) => c.id)))} className="text-blue-600 hover:underline">
                        לעדכן הכל
                      </button>
                      <button type="button" onClick={() => setAccepted(new Set())} className="text-slate-500 hover:underline">
                        לא לעדכן כלום
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    כברירת מחדל <b>לא מעדכנים</b> פרט קיים. מסמנים רק את מה שצריך להחליף. הערות – מתווספות להערות הקיימות.
                  </p>
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {allConflicts.map((c) => (
                      <label key={c.id} className="flex items-start gap-3 p-3 text-sm cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={accepted.has(c.id)}
                          onChange={(e) =>
                            setAccepted((s) => {
                              const next = new Set(s);
                              if (e.target.checked) next.add(c.id);
                              else next.delete(c.id);
                              return next;
                            })
                          }
                          className="w-4 h-4 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-800">
                            {c.donorName} – {c.label}
                          </div>
                          <div className="text-xs text-slate-600 flex flex-wrap items-center gap-1.5">
                            <span className="line-through text-slate-400" dir="auto">{c.current}</span>
                            <ArrowRight className="w-3 h-3 rotate-180 text-slate-400" />
                            <span className="font-medium text-violet-700" dir="auto">
                              {c.append ? `להוסיף: ${c.incoming}` : c.incoming}
                            </span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </section>
              )}

              {/* השלמת פרטים חסרים */}
              {fillUpdates.length > 0 && (
                <section className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 text-sm">
                  <button type="button" onClick={() => setShowFills(!showFills)} className="font-medium text-emerald-800 hover:underline">
                    {fillUpdates.length} תורמים קיימים יקבלו פרטים שחסרים להם (אוטומטית) – {showFills ? 'הסתר' : 'הצג'}
                  </button>
                  {showFills && (
                    <ul className="mt-2 space-y-1 text-xs text-slate-700">
                      {fillUpdates.map((u) => (
                        <li key={u.donorId}>
                          <b>{u.name}:</b>{' '}
                          {Object.entries(u.fills)
                            .map(([f, v]) => `${fieldLabel(f)}: ${displayValue(v)}`)
                            .join(' · ')}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {/* כל השורות */}
              <section className="space-y-2">
                <h3 className="font-bold text-slate-800">כל השורות ({planned.length})</h3>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="p-2 text-right font-medium">שורה</th>
                        <th className="p-2 text-right font-medium">תורם</th>
                        <th className="p-2 text-right font-medium">תרומה</th>
                        <th className="p-2 text-right font-medium">מה יקרה</th>
                        <th className="p-2 text-right font-medium">הערות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRows.slice(0, MAX_TABLE_ROWS).map((p) => {
                        const s = statusOf(p);
                        return (
                          <tr key={p.key} className="border-t border-slate-100 align-top">
                            <td className="p-2 whitespace-nowrap text-slate-500">{rowLabel(p)}</td>
                            <td className="p-2">
                              <div className="font-medium text-slate-800">{incomingName(p)}</div>
                              <div className="text-[11px] text-slate-400" dir="auto">{incomingDetails(p)}</div>
                            </td>
                            <td className="p-2 whitespace-nowrap">
                              {p.donation ? (
                                <>
                                  <div>{canViewAmount ? formatAmount(Number(p.donation.amount ?? 0), String(p.donation.currency ?? 'ILS')) : '🔒'}</div>
                                  <div className="text-[11px] text-slate-400">{displayValue(p.donation.donation_date)}</div>
                                </>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                            <td className="p-2">
                              <span className={`inline-block px-2 py-0.5 rounded-lg border text-[11px] font-medium ${s.tone}`}>{s.text}</span>
                            </td>
                            <td className="p-2 space-y-0.5">
                              {p.row.errors.map((e) => (
                                <div key={e} className="text-red-600">{e}</div>
                              ))}
                              {p.row.warnings.map((w) => (
                                <div key={w} className="text-amber-700">{w}</div>
                              ))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {planned.length > MAX_TABLE_ROWS && (
                  <p className="text-xs text-slate-400">מוצגות {MAX_TABLE_ROWS} שורות (שגיאות והחלטות קודם). כל השורות ייובאו לפי הסיכום שלמעלה.</p>
                )}
              </section>
            </div>
          ) : step === 'running' ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-600">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <div className="font-medium">מייבא… לא לסגור את החלון</div>
              <div className="text-sm text-slate-400">{progress}</div>
            </div>
          ) : (
            /* ===== שלב 4: סיכום ===== */
            result && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-bold text-emerald-700">
                  <CheckCircle2 className="w-6 h-6" />
                  הייבוא הסתיים
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="border border-slate-200 rounded-xl p-3">
                    <div className="text-xs text-slate-500 flex items-center gap-1"><UserPlus className="w-3.5 h-3.5" /> תורמים חדשים</div>
                    <div className="text-2xl font-bold text-blue-700">{result.donorsCreated}</div>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-3">
                    <div className="text-xs text-slate-500 flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" /> תורמים שעודכנו</div>
                    <div className="text-2xl font-bold text-emerald-700">{result.donorsUpdated}</div>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-3">
                    <div className="text-xs text-slate-500">תרומות שנוספו</div>
                    <div className="text-2xl font-bold text-emerald-700">{result.donationsCreated}</div>
                  </div>
                </div>
                {plan.duplicates.length > 0 && (
                  <p className="text-sm text-slate-500">{plan.duplicates.length} תרומות כבר היו במערכת ודולגו.</p>
                )}
                {result.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 space-y-1">
                    <div className="font-bold">{result.errors.length} בעיות:</div>
                    {result.errors.map((e) => (
                      <div key={e}>{e}</div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  תרומות מהייבוא מסומנות כ&quot;ייבוא מאקסל&quot; (סינון מתקדם → מקור). אם נפתחו תורמים כפולים – אפשר למזג ב&quot;בירור כפילויות&quot;.
                </p>
              </div>
            )
          )}
        </div>

        {/* תחתית */}
        {canViewContact && (step === 'review' || step === 'done') && (
          <div className="flex items-center justify-between gap-2 p-4 border-t">
            {step === 'review' ? (
              <>
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50"
                >
                  קובץ אחר
                </button>
                <button
                  type="button"
                  onClick={() => void runImport()}
                  disabled={plan.newDonors.size + plan.updates.length + plan.donations.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  ייבוא
                </button>
              </>
            ) : (
              <>
                <span />
                <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold">
                  סגירה
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
