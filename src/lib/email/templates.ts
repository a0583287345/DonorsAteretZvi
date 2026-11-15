// =====================================================================
// תבניות מייל (משותף לדפדפן ולשרת – בלי סודות)
// שדות להחלפה: {שם} {נושא} {תאריך עברי} {תאריך} {לעילוי נשמת} {פירוט}
// =====================================================================

export type TemplateKey = 'manager' | 'birthday' | 'memorial';

export type EmailTemplate = { subject: string; body: string };

export type EmailTemplates = Record<TemplateKey, EmailTemplate>;

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  manager: 'תזכורת למנהל העמותה',
  birthday: 'ברכת מזל טוב לתורם (יום הולדת)',
  memorial: 'הודעת עילוי נשמה לתורם (יארצייט)',
};

export const PLACEHOLDERS: { key: string; label: string }[] = [
  { key: '{שם}', label: 'שם התורם' },
  { key: '{נושא}', label: 'נושא התזכורת' },
  { key: '{תאריך עברי}', label: 'תאריך המועד בעברית' },
  { key: '{תאריך}', label: 'תאריך המועד הלועזי' },
  { key: '{לעילוי נשמת}', label: 'שם הנפטר (ביארצייט)' },
  { key: '{פירוט}', label: 'פירוט התזכורת' },
];

export const DEFAULT_TEMPLATES: EmailTemplates = {
  manager: {
    subject: 'תזכורת: {נושא} – {תאריך עברי}',
    body:
      'שלום,\n\n' +
      'תזכורת ממערכת ניהול התורמים:\n' +
      '{נושא}\n' +
      'תורם: {שם}\n' +
      'מועד: {תאריך עברי} ({תאריך})\n\n' +
      '{פירוט}\n\n' +
      'מערכת ניהול התורמים – עטרת צבי אשדוד',
  },
  birthday: {
    subject: 'מזל טוב ליום הולדתך!',
    body:
      '{שם} היקר/ה,\n\n' +
      'לרגל יום הולדתך ({תאריך עברי}) אנו שולחים לך ברכת מזל טוב חמה.\n' +
      'יהי רצון שתזכה/י לשנה טובה ומבורכת, לבריאות, לשמחה ולנחת.\n\n' +
      'תודה על תמיכתך הנאמנה בישיבה.\n\n' +
      'בברכה,\n' +
      'ישיבת עטרת צבי אשדוד',
  },
  memorial: {
    subject: 'לעילוי נשמת {לעילוי נשמת}',
    body:
      '{שם} היקר/ה,\n\n' +
      'לקראת יום הזיכרון ({תאריך עברי}) של {לעילוי נשמת},\n' +
      'בני הישיבה יקדישו את לימוד התורה לעילוי נשמתו/ה.\n\n' +
      'יהי זכרו/ה ברוך.\n\n' +
      'בברכה,\n' +
      'ישיבת עטרת צבי אשדוד',
  },
};

/** ממזג תבניות שמורות עם ברירות המחדל */
export function mergeTemplates(saved: unknown): EmailTemplates {
  const result: EmailTemplates = {
    manager: { ...DEFAULT_TEMPLATES.manager },
    birthday: { ...DEFAULT_TEMPLATES.birthday },
    memorial: { ...DEFAULT_TEMPLATES.memorial },
  };
  if (!saved || typeof saved !== 'object') return result;
  for (const key of Object.keys(result) as TemplateKey[]) {
    const t = (saved as Record<string, unknown>)[key];
    if (t && typeof t === 'object') {
      const { subject, body } = t as Record<string, unknown>;
      if (typeof subject === 'string' && subject.trim()) result[key].subject = subject;
      if (typeof body === 'string' && body.trim()) result[key].body = body;
    }
  }
  return result;
}

export type TemplateValues = {
  name: string;
  title: string;
  hebrewDate: string;
  date: string;
  memorialName: string;
  description: string;
};

/** החלפת השדות בתבנית בערכים אמיתיים */
export function renderTemplate(text: string, v: TemplateValues): string {
  return text
    .replaceAll('{שם}', v.name)
    .replaceAll('{נושא}', v.title)
    .replaceAll('{תאריך עברי}', v.hebrewDate)
    .replaceAll('{תאריך}', v.date)
    .replaceAll('{לעילוי נשמת}', v.memorialName)
    .replaceAll('{פירוט}', v.description)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
