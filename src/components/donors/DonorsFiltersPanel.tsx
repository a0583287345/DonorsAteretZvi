'use client';

import MultiSelectFilter from '@/components/filters/MultiSelectFilter';
import {
  DateRangeFilter,
  FiltersShell,
  NumberRangeFilter,
  TextFilter,
  YesNoFilter,
} from '@/components/filters/FilterFields';
import type { DonorFilters } from './useDonorFilters';

type Props = {
  filters: DonorFilters;
  /** בלי הרשאה לראות פרטי התקשרות – לא מציגים סינון לפי טלפון, אימייל, ת"ז וכתובת */
  canViewContact: boolean;
};

/**
 * חיפוש וסינון של רשימת התורמים.
 * רגיל: מדינה, עיר, איש קשר, הוראת קבע, תרמו. מתקדם: כל שאר השדות.
 */
export default function DonorsFiltersPanel({ filters, canViewContact }: Props) {
  const { filters: f, setFilter, options, showFilters, setShowFilters, resetFilters, hasActiveFilters, advancedActiveCount } =
    filters;

  return (
    <FiltersShell
      search={f.search}
      onSearch={(v) => setFilter('search', v)}
      searchPlaceholder="חיפוש בכל פרטי התורם..."
      showAdvanced={showFilters}
      onToggleAdvanced={() => setShowFilters(!showFilters)}
      advancedActiveCount={advancedActiveCount}
      hasActive={hasActiveFilters}
      onReset={resetFilters}
      basic={
        <>
          {canViewContact && (
            <>
              <MultiSelectFilter
                label="מדינה"
                options={options.country}
                selected={f.country}
                onChange={(v) => setFilter('country', v)}
                placeholder="כל המדינות"
              />
              <MultiSelectFilter
                label="עיר"
                options={options.city}
                selected={f.city}
                onChange={(v) => setFilter('city', v)}
                placeholder="כל הערים"
              />
            </>
          )}
          <MultiSelectFilter
            label="איש קשר"
            options={options.contact}
            selected={f.contact}
            onChange={(v) => setFilter('contact', v)}
            placeholder="כל אנשי הקשר"
          />
          <YesNoFilter
            label="הוראת קבע"
            value={f.recurring}
            onChange={(v) => setFilter('recurring', v)}
            yesLabel="עם"
            noLabel="בלי"
          />
          <YesNoFilter
            label="תרמו"
            value={f.hasDonations}
            onChange={(v) => setFilter('hasDonations', v)}
            yesLabel="תרמו"
            noLabel="עוד לא"
          />
        </>
      }
      advanced={
        <>
          {canViewContact && (
            <>
              <MultiSelectFilter
                label="רחוב"
                options={options.street}
                selected={f.street}
                onChange={(v) => setFilter('street', v)}
                placeholder="כל הרחובות"
              />
              <MultiSelectFilter
                label="טלפון"
                options={options.phone}
                selected={f.phone}
                onChange={(v) => setFilter('phone', v)}
                placeholder="הקלידו מספר..."
                allowContains
                dir="ltr"
              />
              <MultiSelectFilter
                label="אימייל"
                options={options.email}
                selected={f.email}
                onChange={(v) => setFilter('email', v)}
                placeholder="הקלידו כתובת..."
                allowContains
                dir="ltr"
              />
              <MultiSelectFilter
                label='ת"ז'
                options={options.zeout}
                selected={f.zeout}
                onChange={(v) => setFilter('zeout', v)}
                placeholder="הקלידו מספר..."
                allowContains
                dir="ltr"
              />
            </>
          )}
          <YesNoFilter
            label="יששכר וזבולון"
            value={f.yissachar}
            onChange={(v) => setFilter('yissachar', v)}
            yesLabel="כן"
            noLabel="לא"
          />
          <DateRangeFilter
            label="נוסף למערכת"
            from={f.createdFrom}
            to={f.createdTo}
            onFrom={(v) => setFilter('createdFrom', v)}
            onTo={(v) => setFilter('createdTo', v)}
          />
          <DateRangeFilter
            label="תרומה אחרונה"
            from={f.lastDonationFrom}
            to={f.lastDonationTo}
            onFrom={(v) => setFilter('lastDonationFrom', v)}
            onTo={(v) => setFilter('lastDonationTo', v)}
          />
          <NumberRangeFilter
            label="מספר תרומות"
            min={f.countMin}
            max={f.countMax}
            onMin={(v) => setFilter('countMin', v)}
            onMax={(v) => setFilter('countMax', v)}
          />
          <TextFilter
            label="הערות"
            value={f.notes}
            onChange={(v) => setFilter('notes', v)}
            placeholder="חיפוש בתוך הערות התורם..."
          />
        </>
      }
    />
  );
}
