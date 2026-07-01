import { useAuthStore } from '@/store/auth.store'
import type { UserRole } from '@/types'

export function usePermissions() {
  const { user } = useAuthStore()
  const role = user?.role as UserRole | undefined

  return {
    hasRole: (...roles: UserRole[]) => !!role && roles.includes(role),
  }
}
