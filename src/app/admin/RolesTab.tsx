'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/logger';
import { useAuth } from '@/components/AuthContext';
import { toast } from '@/components/Toaster';
import {
  ALL_PERMISSIONS,
  PERMISSION_GROUPS,
  normalizeDeniedDisplay,
  normalizePermissions,
  resolveAccess,
  type DeniedDisplayMap,
  type PermissionAccess,
  type PermissionsMap,
} from '@/lib/permissions';
import { Key, Plus, Loader2, Pencil, ShieldCheck, X, Check, Lock, EyeOff } from 'lucide-react';

type RoleRow = {
  id: string;
  name: string;
  permissions: PermissionsMap;
  deniedDisplay: DeniedDisplayMap;
};

const ACCESS_OPTIONS: {
  value: PermissionAccess;
  label: string;
  hint: string;
  icon: React.ReactNode;
  active: string;
}[] = [
  {
    value: 'allowed',
    label: 'מותר',
    hint: 'המשתמש יכול לבצע את הפעולה',
    icon: <Check className="w-3.5 h-3.5" />,
    active: 'bg-emerald-600 text-white border-emerald-600',
  },
  {
    value: 'locked',
    label: 'חסום',
    hint: 'הכפתור מוצג עם מנעול, ובלחיצה מופיעה הודעת "אין לך הרשאה"',
    icon: <Lock className="w-3.5 h-3.5" />,
    active: 'bg-amber-500 text-white border-amber-500',
  },
  {
    value: 'hidden',
    label: 'מוסתר',
    hint: 'הכפתור לא מוצג בכלל',
    icon: <EyeOff className="w-3.5 h-3.5" />,
    active: 'bg-slate-600 text-white border-slate-600',
  },
];

const ACCESS_BADGE: Record<PermissionAccess, string> = {
  allowed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  locked: 'bg-amber-50 text-amber-700 border-amber-200',
  hidden: '',
};

export default function RolesTab() {
  const { refreshProfile } = useAuth();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [roleName, setRoleName] = useState('');
  // מצב כל הרשאה בטופס: מותר / חסום / מוסתר
  const [accessMap, setAccessMap] = useState<Record<string, PermissionAccess>>({});

  const fetchRoles = async () => {
    const { data, error } = await supabase
      .from('roles')
      .select('id, name, permissions, denied_display')
      .order('created_at', { ascending: true });

    if (error) {
      toast.error(`שגיאה בטעינת התפקידים: ${error.message}`);
    } else if (data) {
      setRoles(
        data.map((r) => ({
          id: r.id as string,
          name: r.name as string,
          permissions: normalizePermissions(r.permissions),
          deniedDisplay: normalizeDeniedDisplay(r.denied_display),
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    // טעינה ראשונית (אחרי רינדור, לא באופן סינכרוני בתוך ה-effect)
    const t = setTimeout(() => void fetchRoles(), 0);
    return () => clearTimeout(t);
  }, []);

  const openModal = (role: RoleRow | null) => {
    setSelectedRole(role);
    setRoleName(role?.name ?? '');
    setAccessMap(
      Object.fromEntries(
        ALL_PERMISSIONS.map((p) => [
          p.id,
          role ? resolveAccess(p.id, role.permissions, role.deniedDisplay) : 'hidden',
        ])
      )
    );
    setIsModalOpen(true);
  };

  const setAccess = (permId: string, value: PermissionAccess) => {
    setAccessMap((prev) => ({ ...prev, [permId]: value }));
  };

  // קביעת מצב אחד לכל ההרשאות בקבוצה
  const setGroupAccess = (permIds: string[], value: PermissionAccess) => {
    setAccessMap((prev) => {
      const next = { ...prev };
      permIds.forEach((id) => {
        next[id] = value;
      });
      return next;
    });
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = roleName.trim();
    if (!name) {
      toast.warning('יש להזין שם תפקיד');
      return;
    }

    // שומרים את ההרשאות ואת אופן התצוגה בנפרד:
    // permissions נאכף במסד (RLS), denied_display משפיע רק על התצוגה.
    const permissions: PermissionsMap = {};
    const denied_display: DeniedDisplayMap = {};
    for (const p of ALL_PERMISSIONS) {
      const value = accessMap[p.id] ?? 'hidden';
      permissions[p.id] = value === 'allowed';
      if (value === 'locked') denied_display[p.id] = 'locked';
    }

    setActionLoading(true);
    try {
      const { error } = selectedRole
        ? await supabase
            .from('roles')
            .update({ name, permissions, denied_display })
            .eq('id', selectedRole.id)
        : await supabase.from('roles').insert([{ name, permissions, denied_display }]);

      if (error) throw error;

      await logActivity(
        selectedRole ? 'update' : 'create',
        'roles',
        selectedRole ? `עודכנו הרשאות התפקיד: ${name}` : `נוצר תפקיד חדש: ${name}`
      );

      toast.success('התפקיד נשמר בהצלחה');
      setIsModalOpen(false);
      await fetchRoles();
      // אם שינינו את התפקיד של המשתמש הנוכחי – שהשינוי ייכנס לתוקף מיד
      await refreshProfile();
    } catch (error) {
      const message = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error);
      toast.error(`שגיאה בשמירת התפקיד: ${message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6 bg-white border-b border-slate-100 pb-4">
        <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
          <Key className="w-5 h-5 text-slate-400" />
          ניהול תפקידים והרשאות
        </h2>

        <button
          onClick={() => openModal(null)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors text-sm font-bold shadow-sm"
        >
          <Plus className="w-4 h-4" />
          צור תפקיד
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
        {roles.map((role) => {
          const visible = ALL_PERMISSIONS.map((p) => ({
            perm: p,
            state: resolveAccess(p.id, role.permissions, role.deniedDisplay),
          })).filter((x) => x.state !== 'hidden');

          return (
            <div
              key={role.id}
              className="border border-slate-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-500" />
                  {role.name}
                </h3>

                <button
                  onClick={() => openModal(role)}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  title="ערוך הרשאות"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 flex-1 bg-white">
                <div className="flex flex-wrap gap-1.5">
                  {visible.map(({ perm, state }) => (
                    <span
                      key={perm.id}
                      className={`px-2 py-1 border text-[11px] rounded-md font-medium inline-flex items-center gap-1 ${ACCESS_BADGE[state]}`}
                    >
                      {state === 'locked' && <Lock className="w-3 h-3" />}
                      {perm.label}
                    </span>
                  ))}

                  {visible.length === 0 && (
                    <span className="text-sm text-slate-400 italic">לא הוגדרו הרשאות לתפקיד זה</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ================= MODAL ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden relative border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                {selectedRole ? 'עריכת תפקיד' : 'יצירת תפקיד חדש'}
              </h2>

              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
              <form id="role-form" onSubmit={handleSaveRole} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    שם התפקיד (לדוגמה: עורך, רואה חשבון, מנהל)
                  </label>
                  <input
                    type="text"
                    required
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    className="w-full max-w-sm px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                    placeholder="הזן את שם התפקיד"
                  />
                </div>

                {/* מקרא */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-slate-600 space-y-1">
                  {ACCESS_OPTIONS.map((o) => (
                    <div key={o.value} className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-bold ${o.active}`}>
                        {o.icon}
                        {o.label}
                      </span>
                      <span>{o.hint}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  {PERMISSION_GROUPS.map((group) => {
                    const ids = group.permissions.map((p) => p.id);
                    return (
                      <div key={group.title} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-200">
                          <h4 className="font-bold text-slate-800 text-sm">{group.title}</h4>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500">
                            <span>הכול:</span>
                            {ACCESS_OPTIONS.map((o) => (
                              <button
                                key={o.value}
                                type="button"
                                onClick={() => setGroupAccess(ids, o.value)}
                                className="px-2 py-0.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 transition"
                              >
                                {o.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          {group.permissions.map((perm) => {
                            const current = accessMap[perm.id] ?? 'hidden';
                            return (
                              <div
                                key={perm.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-lg hover:bg-white transition"
                              >
                                <span className="text-sm font-medium text-slate-700 leading-tight">{perm.label}</span>

                                <div
                                  role="radiogroup"
                                  aria-label={perm.label}
                                  className="inline-flex rounded-lg border border-slate-200 bg-white overflow-hidden shrink-0"
                                >
                                  {ACCESS_OPTIONS.map((o) => {
                                    const selected = current === o.value;
                                    return (
                                      <button
                                        key={o.value}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        title={o.hint}
                                        onClick={() => setAccess(perm.id, o.value)}
                                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold border-l last:border-l-0 border-slate-200 transition ${
                                          selected ? o.active : 'text-slate-500 hover:bg-slate-50'
                                        }`}
                                      >
                                        {o.icon}
                                        {o.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-slate-100 bg-white shrink-0 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-bold transition"
              >
                ביטול
              </button>

              <button
                form="role-form"
                disabled={actionLoading}
                type="submit"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm flex justify-center items-center gap-2 transition shadow-sm min-w-[120px]"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'שמור שינויים'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
