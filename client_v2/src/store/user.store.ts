import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { userService } from '@/services/api/user.service'
import type { User } from '@/types'
import { LoadingState } from '@/types'

interface UserState {
  users: User[]
  selectedUser: User | null
  loading: LoadingState
  error: string | null
}

interface UserActions {
  loadUsers: () => Promise<void>
  createUser: (username: string, password: string, role: 'admin' | 'user') => Promise<User | null>
  updateUser: (userId: number, payload: { username?: string; password?: string; role?: 'admin' | 'user' }) => Promise<User | null>
  deleteUser: (userId: number) => Promise<boolean>
  selectUser: (userId: number | null) => Promise<void>
  clearSelectedUser: () => void
}

export const useUserStore = create<UserState & UserActions>()(
  immer((set, get) => ({
    users: [],
    selectedUser: null,
    loading: 'idle',
    error: null,

    loadUsers: async () => {
      set(state => { state.loading = 'loading'; state.error = null; });
      try {
        const response = await userService.apiGetAllUsers();
        if (response.success && response.data) {
          set(state => { state.users = response.data!; state.loading = 'success'; });
        } else {
          set(state => { state.error = response.error || 'Failed to load users'; state.loading = 'error'; });
        }
      } catch (err: any) {
        set(state => { state.error = err.message || 'An unexpected error occurred'; state.loading = 'error'; });
      }
    },

    createUser: async (username, password, role) => {
      set(state => { state.loading = 'loading'; state.error = null; });
      try {
        const response = await userService.apiCreateUser({ username, password, role });
        if (response.success && response.data) {
          set(state => { state.users.push(response.data!); state.loading = 'success'; });
          return response.data;
        } else {
          set(state => { state.error = response.error || 'Failed to create user'; state.loading = 'error'; });
          return null;
        }
      } catch (err: any) {
        set(state => { state.error = err.message || 'An unexpected error occurred'; state.loading = 'error'; });
        return null;
      }
    },

    updateUser: async (userId, payload) => {
      set(state => { state.loading = 'loading'; state.error = null; });
      try {
        const response = await userService.apiUpdateUser(userId, payload);
        if (response.success && response.data) {
          set(state => {
            const index = state.users.findIndex(u => u.id === userId);
            if (index !== -1) {
              state.users[index] = response.data!;
            }
            if (state.selectedUser?.id === userId) {
              state.selectedUser = response.data;
            }
            state.loading = 'success';
          });
          return response.data;
        } else {
          set(state => { state.error = response.error || 'Failed to update user'; state.loading = 'error'; });
          return null;
        }
      } catch (err: any) {
        set(state => { state.error = err.message || 'An unexpected error occurred'; state.loading = 'error'; });
        return null;
      }
    },

    deleteUser: async (userId) => {
      set(state => { state.loading = 'loading'; state.error = null; });
      try {
        const response = await userService.apiDeleteUser(userId);
        if (response.success) {
          set(state => {
            state.users = state.users.filter(u => u.id !== userId);
            if (state.selectedUser?.id === userId) {
              state.selectedUser = null;
            }
            state.loading = 'success';
          });
          return true;
        } else {
          set(state => { state.error = response.error || 'Failed to delete user'; state.loading = 'error'; });
          return false;
        }
      } catch (err: any) {
        set(state => { state.error = err.message || 'An unexpected error occurred'; state.loading = 'error'; });
        return false;
      }
    },

    selectUser: async (userId) => {
      if (userId === null) {
        set(state => { state.selectedUser = null; });
        return;
      }
      set(state => { state.loading = 'loading'; state.error = null; });
      try {
        const response = await userService.apiGetUserById(userId);
        if (response.success && response.data) {
          set(state => { state.selectedUser = response.data!; state.loading = 'success'; });
        } else {
          set(state => { state.error = response.error || 'Failed to load user details'; state.loading = 'error'; });
        }
      } catch (err: any) {
        set(state => { state.error = err.message || 'An unexpected error occurred'; state.loading = 'error'; });
      }
    },

    clearSelectedUser: () => {
      set(state => { state.selectedUser = null; });
    },
  }))
);
