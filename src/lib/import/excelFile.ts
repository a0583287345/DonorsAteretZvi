// =====================================================================
// ייבוא מאקסל – תבנית ריקה להורדה + קריאת הקובץ שהועלה (בדפדפן)
// =====================================================================

import * as XLSX from 'xlsx';
import {
  DONATION_SHEET_COLUMNS,
  DONOR_COLUMNS,
  INSTRUCTIONS_SHEET,
  PAYMENT_OPTIONS_TEXT,
  SHEET_NAMES,
  matchHeader,
  parseCell,
  type ColumnDef,
  type ParsedValue,
  type SheetKind,
} from './excelColumns';

export const columnsOf = (kind: SheetKind): ColumnDef[] => (kind === 'donors' ? DONOR_COLUMNS : DONATION_SHEET_COLUMNS);

const headerText = (c: ColumnDef) => (c.required ? `${c.header} *` : c.header);

function dataSheet(kind: SheetKind): XLSX.WorkSheet {
  const cols = columnsOf(kind);
  const ws = XLSX.utils.aoa_to_sheet([cols.map(headerText)]);
  ws['!cols'] = cols.map((c) => ({ wch: Math.max(c.width, c.header.length + 3) }));
  // אפס מוביל שאקסל מוחק מטלפון / ת"ז מוחזר בקריאה (normalizePhone / normalizeZeout)
  ws['!views'] = [{ RTL: true }];
  return ws;
}

function instructionsSheet(): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['ייבוא תורמים ותרומות – הוראות'],
    [],
    ['איך מייבאים'],
    ['1', 'ממלאים את הגיליון "תורמים" ו/או את הגיליון "תרומות" – שורה אחת לכל תורם / תרומה, החל מהשורה השנייה.'],
    ['2', 'לא משנים את שורת הכותרות ולא את שמות הגיליונות. אפשר למחוק עמודות שלא צריך, ואפשר להשאיר תאים ריקים.'],
    ['3', 'שומרים את הקובץ (xlsx) ומעלים אותו במערכת: לשונית תורמים או תרומות ← "ייבוא מאקסל".'],
    ['4', 'לפני השמירה מוצגת בדיקה של כל שורה: למי היא תשויך, מה ייווצר, ושגיאות לתיקון. שום דבר לא נשמר עד שלוחצים "ייבוא".'],
    [],
    ['איך מזוהה תורם קיים'],
    ['', 'לפי הסדר: ת"ז ← טלפון ← מייל (כשהשם לא סותר). אם לא נמצא – ייפתח תורם חדש.'],
    ['', 'כשיש כמה תורמים אפשריים, או רק שם זהה – בוחרים בבדיקה לפני הייבוא למי לשייך.'],
    ['', 'לתורם קיים: פרטים שחסרים לו נוספים אוטומטית. פרטים שכבר קיימים ושונים בקובץ (למשל מייל אחר) – המערכת שואלת אם לעדכן.'],
    ['', 'בגיליון "תרומות" מספיק למלא את פרטי הזיהוי של התורם. תורם חדש מגיליון התרומות נפתח עם הפרטים האלה בלבד.'],
    [],
    ['כפילויות'],
    ['', 'תרומה עם אותו תורם, אותו תאריך, אותו סכום ואותו מטבע שכבר קיימת במערכת – לא תיובא שוב. לכן בטוח להעלות את אותו קובץ פעמיים.'],
    ['', 'אותו תורם שמופיע בכמה שורות בקובץ (למשל כמה תרומות) – ייפתח פעם אחת בלבד.'],
    [],
    ['העמודות', 'חובה', 'פירוט', 'דוגמה'],
  ];

  for (const kind of ['donors', 'donations'] as SheetKind[]) {
    rows.push([], [`גיליון "${SHEET_NAMES[kind]}"`]);
    for (const c of columnsOf(kind)) rows.push([c.header, c.required ? 'כן' : '', c.help, c.example]);
  }

  rows.push([], ['אמצעי תשלום אפשריים'], ['', PAYMENT_OPTIONS_TEXT]);
  rows.push([], ['מטבעות'], ['', 'ILS (שקל), USD (דולר), EUR (יורו), GBP (ליש"ט)']);
  rows.push([], ['טיפ'], ['', 'כדי שאקסל לא ימחק את האפס בתחילת טלפון או ת"ז – לסמן את העמודה ← עיצוב תאים ← טקסט, לפני ההדבקה.']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 24 }, { wch: 8 }, { wch: 90 }, { wch: 18 }];
  ws['!views'] = [{ RTL: true }];
  return ws;
}

/** הורדת תבנית ריקה: תורמים, תרומות והוראות */
export function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, dataSheet('donors'), SHEET_NAMES.donors);
  XLSX.utils.book_append_sheet(wb, dataSheet('donations'), SHEET_NAMES.donations);
  XLSX.utils.book_append_sheet(wb, instructionsSheet(), INSTRUCTIONS_SHEET);
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.writeFile(wb, 'תבנית_ייבוא_תורמים_ותרומות.xlsx');
}

// ---------------------------------------------------------------------
// קריאת הקובץ
// ---------------------------------------------------------------------

export type ExcelRow = {
  sheet: SheetKind;
  /** מספר השורה בקובץ (כמו שאקסל מציג) */
  rowNumber: number;
  values: Record<string, ParsedValue>;
  errors: string[];
  warnings: string[];
};

export type ExcelReadResult = {
  rows: ExcelRow[];
  /** הודעות כלליות על הקובץ (גיליון חסר, עמודה לא מוכרת...) */
  notices: string[];
};

/** מאיזה סוג הגיליון: לפי השם, ואם השם שונה – לפי הכותרות (עמודת "סכום" = תרומות) */
function sheetKindOf(name: string, headers: unknown[]): SheetKind | null {
  if (name.trim() === SHEET_NAMES.donors) return 'donors';
  if (name.trim() === SHEET_NAMES.donations) return 'donations';
  if (name.trim() === INSTRUCTIONS_SHEET) return null;
  if (headers.some((h) => matchHeader(DONATION_SHEET_COLUMNS, h)?.field === 'amount')) return 'donations';
  if (headers.some((h) => matchHeader(DONOR_COLUMNS, h))) return 'donors';
  return null;
}

const MAX_ROWS = 5000;

export async function readExcelFile(file: File): Promise<ExcelReadResult> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const rows: ExcelRow[] = [];
  const notices: string[] = [];

  for (const name of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, blankrows: false, defval: null, raw: true });
    if (grid.length === 0) continue;
    const headers = grid[0] ?? [];
    const kind = sheetKindOf(name, headers);
    if (!kind) continue;

    const cols = columnsOf(kind);
    const mapping = headers.map((h) => matchHeader(cols, h));
    const unknown = headers.filter((h, i) => String(h ?? '').trim() && !mapping[i]).map(String);
    if (unknown.length) notices.push(`גיליון "${name}": עמודות לא מוכרות לא ייובאו – ${unknown.join(', ')}`);
    for (const c of cols.filter((c) => c.required && !mapping.includes(c))) {
      notices.push(`גיליון "${name}": חסרה העמודה "${c.header}" (חובה)`);
    }

    const body = grid.slice(1);
    if (body.length > MAX_ROWS) notices.push(`גיליון "${name}": נקראו רק ${MAX_ROWS} השורות הראשונות`);

    body.slice(0, MAX_ROWS).forEach((cells, i) => {
      if (!cells.some((c) => c !== null && String(c).trim() !== '')) return;
      const row: ExcelRow = { sheet: kind, rowNumber: i + 2, values: {}, errors: [], warnings: [] };
      mapping.forEach((col, ci) => {
        if (!col) return;
        const r = parseCell(col, cells[ci]);
        row.values[col.field] = r.value;
        if (r.error) row.errors.push(r.error);
        if (r.warning) row.warnings.push(r.warning);
      });
      // עמודת חובה שחסרה לגמרי בקובץ
      for (const c of cols.filter((c) => c.required && !mapping.includes(c))) row.errors.push(`חסר ${c.header}`);
      rows.push(row);
    });
  }

  if (rows.length === 0 && notices.length === 0) {
    notices.push(`לא נמצאו שורות לייבוא. יש למלא את הגיליון "${SHEET_NAMES.donors}" או "${SHEET_NAMES.donations}" בתבנית.`);
  }
  return { rows, notices };
}
