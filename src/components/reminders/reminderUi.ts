import type { ReminderStatus } from '@/lib/reminders/recurrence';

/** צבעים ותוויות לכל מצב תזכורת */
export const STATUS_STYLES: Record<
  ReminderStatus,
  { label: string; badge: string; header: string; dot: string; order: number }
> = {
  overdue: {
    label: 'באיחור',
    badge: 'bg-red-50 text-red-700 border-red-200',
    header: 'bg-red-50/60 border-red-100',
    dot: 'bg-red-500',
    order: 0,
  },
  today: {
    label: 'להיום',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    header: 'bg-amber-50/60 border-amber-100',
    dot: 'bg-amber-500',
    order: 1,
  },
  soon: {
    label: 'בקרוב',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    header: 'bg-purple-50/60 border-purple-100',
    dot: 'bg-purple-500',
    order: 2,
  },
  scheduled: {
    label: 'מתוכנן',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    header: 'bg-slate-50 border-slate-100',
    dot: 'bg-blue-400',
    order: 3,
  },
  done: {
    label: 'הושלם',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    header: 'bg-emerald-50/60 border-emerald-100',
    dot: 'bg-emerald-500',
    order: 4,
  },
};

/** מקור תזכורת אוטומטית */
export const SOURCE_LABELS: Record<string, string> = {
  donor_birthday_gregorian: 'יום הולדת לועזי',
  donor_birthday_hebrew: 'יום הולדת עברי',
  donor_yahrzeit: 'יארצייט',
};

/** סוג הודעה לתורם */
export const DONOR_MESSAGE_LABELS: Record<string, string> = {
  none: 'ללא הודעה לתורם',
  birthday: 'ברכת מזל טוב (יום הולדת)',
  memorial: 'הודעת עילוי נשמה (יארצייט)',
  custom: 'הודעה חופשית',
};
