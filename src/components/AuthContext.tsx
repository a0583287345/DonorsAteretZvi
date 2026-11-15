'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toaster';
import {
  deniedMessage,
  normalizeDeniedDisplay,
  normalizePermissions,
  resolveAccess,
  type DeniedDisplayMap,
  type PermissionAccess,
  type PermissionsMap,
} from '@/lib/permissions';

// =====================================================================
// מקור אחד למשתמש המחובר, לפרופיל ולהרשאות.
// כל הקומפוננטות קוראות מכאן (ישירות או דרך usePermissions / <Protect>).
// =====================================================================

type Role = {
  name: string;
  permissions: PermissionsMap;
  deniedDisplay: DeniedDisplayMap;
};

export type UserProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role | null;
};

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  permissions: PermissionsMap;
  /** האם מותר (true/false) */
  hasPermission: (permId: string) => boolean;
  /** allowed / locked / hidden – לפי הגדרת התפקיד */
  access: (permId: string) => PermissionAccess;
  /**
   * לשימוש בתוך פעולות: מחזיר true אם מותר.
   * אם אסור – מציג הודעת "אין לך הרשאה" ומחזיר false.
   */
  requirePermission: (permId: string) => boolean;
  /** טעינה מחדש של הפרופיל (למשל אחרי שינוי הרשאות) */
  refreshProfile: () => Promise<void>;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: { name: string; permissions: unknown; denied_display: unknown } | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function loadProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, role:roles(name, permissions, denied_display)')
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  const row = data as unknown as ProfileRow;
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role
      ? {
          name: row.role.name,
          permissions: normalizePermissions(row.role.permissions),
          deniedDisplay: normalizeDeniedDisplay(row.role.denied_display),
        }
      : null,
  };
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let currentUserId: string | null = null;

    const apply = async (nextUser: User | null) => {
      setUser(nextUser);
      if (!nextUser) {
        currentUserId = null;
        setProfile(null);
        setLoading(false);
        return;
      }
      // רענון טוקן שולח אירוע עם אותו משתמש – אין צורך לטעון שוב את הפרופיל
      if (nextUser.id === currentUserId) return;
      currentUserId = nextUser.id;
      setLoading(true);
      const p = await loadProfile(nextUser.id);
      if (active && currentUserId === nextUser.id) {
        setProfile(p);
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // לא מחכים בתוך ה-callback (מומלץ ע"י Supabase כדי למנוע תקיעות)
      setTimeout(() => {
        if (active) void apply(session?.user ?? null);
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    setProfile(await loadProfile(user.id));
  }, [user]);

  const value = useMemo<AuthContextType>(() => {
    const permissions = profile?.role?.permissions ?? {};
    const deniedDisplay = profile?.role?.deniedDisplay ?? {};
    const hasPermission = (permId: string) => permissions[permId] === true;
    return {
      user,
      profile,
      loading,
      permissions,
      hasPermission,
      access: (permId) => resolveAccess(permId, permissions, deniedDisplay),
      requirePermission: (permId) => {
        if (hasPermission(permId)) return true;
        toast.denied(deniedMessage(permId));
        return false;
      },
      refreshProfile,
    };
  }, [user, profile, loading, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
