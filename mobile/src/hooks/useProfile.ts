import { useQuery } from '@tanstack/react-query';
import { meApi, type MeResponse } from '@/api/me';
import type { UserRole } from '@/types';

export function useProfile() {
  const q = useQuery({
    queryKey: ['me'],
    queryFn: meApi.get,
    staleTime: 5 * 60 * 1000,
  });

  const profile = q.data ?? null;
  return {
    profile,
    isLoading: q.isLoading,
    error: q.error,
    refetch: q.refetch,
    role: profile?.role ?? null,
    isManager: profile ? isManager(profile.role) : false,
    isFullManager: profile ? isFullManager(profile.role) : false,
  };
}

export function isManager(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'sales_manager' || role === 'team_lead';
}

export function isFullManager(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'sales_manager';
}

export function canBulkAssign(role: UserRole | null | undefined): boolean {
  return role !== null && role !== undefined && role !== 'sales_rep';
}

export type { MeResponse };
