import { useAuth } from '@/components/AuthContext';

// עטיפה דקה ל-AuthContext – כל ההרשאות מגיעות ממקור אחד.
export function usePermissions() {
  const { permissions, hasPermission, access, requirePermission, loading } = useAuth();
  return {
    permissions,
    hasPermission,
    access,
    requirePermission,
    loadingPerms: loading,
  };
}
