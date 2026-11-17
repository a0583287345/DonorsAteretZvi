// =====================================================================
// ייבוא מאקסל – ביצוע (בדפדפן, בהרשאות המשתמש המחובר; RLS נאכף במסד)
//   1. תורמים חדשים   2. עדכון תורמים קיימים (שדות ריקים + שינויים שאושרו)   3. תרומות
// =====================================================================

import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/logger';
import type { TablesInsert, TablesUpdate } from '@/types/database';
import type { Donor } from '@/types/donor';
import { loadDonorYahrzeits, syncDonorAutoReminders } from '@/lib/reminders/donorAuto';
import { donorDisplayName, nameTokens, normalizeEmail, normalizePhone, normalizeZeout } from './donorMatch';
import type { ParsedValue } from './excelColumns';
import type { DonorValues, ImportPlan } from './excelPlan';

export const EXCEL_SOURCE = 'excel';

export type ExecuteOptions = {
  donors: Donor[];
  acceptedConflicts: Set<string>;
  canCreateDonors: boolean;
  canEditDonors: boolean;
  canCreateDonations: boolean;
  userId?: string;
  onProgress?: (text: string) => void;
};

export type ExecuteResult = {
  donorsCreated: number;
  donorsUpdated: number;
  donationsCreated: number;
  errors: string[];
};

const str = (v: ParsedValue | undefined) => (typeof v === 'string' && v.trim() ? v.trim() : null);

function donorPayload(v: DonorValues): TablesInsert<'donors'> {
  return {
    first_name_he: str(v.first_name_he),
    last_name_he: str(v.last_name_he),
    first_name_en: str(v.first_name_en),
    last_name_en: str(v.last_name_en),
    zeout: str(v.zeout),
    phone_1: str(v.phone_1) ?? str(v.phone_2),
    phone_2: str(v.phone_1) ? str(v.phone_2) : null,
    email: str(v.email),
    country: str(v.country),
    city: str(v.city),
    street: str(v.street),
    house_number: str(v.house_number),
    connected_contact: str(v.connected_contact),
    has_yissachar_zevulun: v.has_yissachar_zevulun === true,
    yissachar_zevulun_name: str(v.yissachar_zevulun_name),
    birthday: str(v.birthday),
    notes: str(v.notes),
  };
}

/** מפתח לזיהוי אותו אדם בין תורמים חדשים שנבחרו ידנית ("תורם חדש") באותו ייבוא */
function identityKey(v: DonorValues): string {
  return (
    normalizeZeout(str(v.zeout)) ??
    normalizePhone(str(v.phone_1)) ??
    normalizeEmail(str(v.email)) ??
    `name:${nameTokens(str(v.first_name_he), str(v.last_name_he)).sort().join(' ')}`
  );
}

const nameOf = (v: DonorValues) =>
  [str(v.first_name_he), str(v.last_name_he)].filter(Boolean).join(' ') ||
  [str(v.first_name_en), str(v.last_name_en)].filter(Boolean).join(' ') ||
  'ללא שם';

async function syncBirthday(id: string, name: string, birthday: string | null, userId?: string) {
  if (!birthday) return;
  await syncDonorAutoReminders(
    { id, name, birthday, birthday_after_sunset: false, yahrzeits: await loadDonorYahrzeits(id) },
    userId
  );
}

export async function executeImport(plan: ImportPlan, opts: ExecuteOptions): Promise<ExecuteResult> {
  const result: ExecuteResult = { donorsCreated: 0, donorsUpdated: 0, donationsCreated: 0, errors: [] };
  const realId = new Map<string, string>();
  const byIdentity = new Map<string, string>();
  const donorById = new Map(opts.donors.map((d) => [d.id, d]));
  const rowsLabel = (rows: { row: { sheet: string; rowNumber: number } }[]) =>
    rows.map((r) => `${r.row.sheet === 'donors' ? 'תורמים' : 'תרומות'} ${r.row.rowNumber}`).join(', ');

  // 1. תורמים חדשים
  if (plan.newDonors.size) {
    if (!opts.canCreateDonors) {
      result.errors.push(`אין הרשאה ליצור תורמים – ${plan.newDonors.size} תורמים חדשים (והתרומות שלהם) לא יובאו`);
    } else {
      let i = 0;
      for (const [tempId, { values, rows }] of plan.newDonors) {
        opts.onProgress?.(`יוצר תורמים חדשים ${++i}/${plan.newDonors.size}`);
        const key = identityKey(values);
        const known = byIdentity.get(key);
        if (known) {
          realId.set(tempId, known);
          continue;
        }
        const payload = donorPayload(values);
        const { data, error } = await supabase.from('donors').insert(payload).select('id').single();
        if (error || !data) {
          result.errors.push(`שורה ${rowsLabel(rows)}: יצירת התורם נכשלה – ${error?.message ?? 'שגיאה'}`);
          continue;
        }
        realId.set(tempId, data.id);
        byIdentity.set(key, data.id);
        result.donorsCreated += 1;
        try {
          await syncBirthday(data.id, nameOf(values), payload.birthday ?? null, opts.userId);
        } catch {
          result.errors.push(`${nameOf(values)}: התורם נוצר, אבל תזכורת יום ההולדת לא נוצרה`);
        }
      }
    }
  }

  // 2. עדכון תורמים קיימים
  const updates = plan.updates
    .map((u) => {
      const accepted = u.conflicts.filter((c) => opts.acceptedConflicts.has(c.id));
      return { u, accepted };
    })
    .filter(({ u, accepted }) => Object.keys(u.fills).length || accepted.length);

  if (updates.length) {
    if (!opts.canEditDonors) {
      result.errors.push(`אין הרשאה לערוך תורמים – ${updates.length} תורמים קיימים לא עודכנו (התרומות שלהם כן יובאו)`);
    } else {
      let i = 0;
      for (const { u, accepted } of updates) {
        opts.onProgress?.(`מעדכן תורמים קיימים ${++i}/${updates.length}`);
        const existing = donorById.get(u.donorId);
        const changes: TablesUpdate<'donors'> = {};
        const set = (field: string, value: ParsedValue) => {
          (changes as Record<string, ParsedValue>)[field] = value;
        };
        for (const [f, v] of Object.entries(u.fills)) set(f, v as ParsedValue);
        for (const c of accepted) {
          if (c.append && existing?.notes) set('notes', `${existing.notes}\n${String(c.value)}`);
          else set(c.field, c.value);
        }
        const { error } = await supabase.from('donors').update(changes).eq('id', u.donorId);
        if (error) {
          result.errors.push(`${u.name}: העדכון נכשל – ${error.message}`);
          continue;
        }
        result.donorsUpdated += 1;
        if (changes.birthday && existing) {
          try {
            await syncBirthday(u.donorId, donorDisplayName(existing), changes.birthday, opts.userId);
          } catch {
            result.errors.push(`${u.name}: תזכורת יום ההולדת לא עודכנה`);
          }
        }
      }
    }
  }

  // 3. תרומות
  if (plan.donations.length) {
    if (!opts.canCreateDonations) {
      result.errors.push(`אין הרשאה להוסיף תרומות – ${plan.donations.length} תרומות לא יובאו`);
    } else {
      const now = new Date().toISOString();
      const rows: TablesInsert<'donations'>[] = [];
      for (const { row, target } of plan.donations) {
        const donorId = target.startsWith('new:') ? realId.get(target) : target;
        if (!donorId) continue; // התורם החדש לא נוצר – השגיאה כבר נרשמה
        const d = row.donation!;
        rows.push({
          donor_id: donorId,
          amount: Number(d.amount),
          currency: str(d.currency) ?? 'ILS',
          donation_date: str(d.donation_date),
          payment_method: str(d.payment_method) ?? 'other',
          receipt_number: str(d.receipt_number),
          category: str(d.category),
          installments: typeof d.installments === 'number' ? d.installments : null,
          notes: str(d.donation_notes),
          external_source: EXCEL_SOURCE,
          imported_at: now,
        });
      }
      for (let from = 0; from < rows.length; from += 200) {
        opts.onProgress?.(`מוסיף תרומות ${Math.min(from + 200, rows.length)}/${rows.length}`);
        const chunk = rows.slice(from, from + 200);
        const { error } = await supabase.from('donations').insert(chunk);
        if (error) result.errors.push(`הוספת תרומות ${from + 1}-${from + chunk.length} נכשלה – ${error.message}`);
        else result.donationsCreated += chunk.length;
      }
    }
  }

  await logActivity(
    'IMPORT',
    'donors',
    `ייבוא מאקסל: ${result.donorsCreated} תורמים חדשים, ${result.donorsUpdated} תורמים עודכנו, ${result.donationsCreated} תרומות` +
      (plan.duplicates.length ? `, ${plan.duplicates.length} תרומות קיימות דולגו` : '') +
      (result.errors.length ? `, ${result.errors.length} שגיאות` : '')
  );

  return result;
}
