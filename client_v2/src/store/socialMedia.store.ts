/**
 * Zustand Store per Social Media Manager - MVP Phase 1
 * Gestisce stato globale per accounts, categories, posts con cache e optimistic updates
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '@/services/api/client';
import type { SocialAccount, Category, Post, PostsStats, PostsResponse, CreatePostRequest, UpdatePostRequest } from '@/features/social-media-manager/types';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti
const MAX_RETRIES = 3;

interface SocialMediaState {
  // Data
  accounts: SocialAccount[];
  categories: Category[];
  posts: Post[];
  currentPost: Post | null;
  stats: PostsStats | null;

  // Pagination
  currentPage: number;
  totalPages: number;
  totalPosts: number;
  perPage: number;

  // Filters
  filters: {
    status?: string;
    category_id?: number;
    content_type?: string;
    search?: string;
  };

  // Loading states
  isLoading: boolean;
  isLoadingAccounts: boolean;
  isLoadingCategories: boolean;
  isLoadingPosts: boolean;
  error: string | null;

  // Cache
  lastUpdated: {
    accounts: number;
    categories: number;
    posts: number;
    stats: number;
  };

  // Actions - Accounts
  loadAccounts: () => Promise<void>;
  updateAccount: (id: number, data: Partial<SocialAccount>) => Promise<SocialAccount>;

  // Actions - Categories
  loadCategories: () => Promise<void>;
  createCategory: (data: { name: string; description?: string; color?: string; icon?: string }) => Promise<Category>;

  // Actions - Posts
  loadPosts: (options?: { page?: number; per_page?: number; status?: string; category_id?: number; content_type?: string; search?: string }) => Promise<void>;
  setFilters: (filters: Partial<SocialMediaState['filters']>) => void;
  clearFilters: () => void;
  loadPostById: (id: number) => Promise<Post | null>;
  createPost: (data: CreatePostRequest) => Promise<Post>;
  updatePost: (id: number, data: UpdatePostRequest) => Promise<Post>;
  deletePost: (id: number) => Promise<void>;
  setCurrentPost: (post: Post | null) => void;

  // Actions - Stats
  loadStats: () => Promise<void>;

  // Utils
  invalidateCache: (type?: 'accounts' | 'categories' | 'posts' | 'stats' | 'all') => void;
  resetError: () => void;
}

export const useSocialMediaStore = create<SocialMediaState>()(
  persist(
    (set, get) => ({
      // Initial state
      accounts: [],
      categories: [],
      posts: [],
      currentPost: null,
      stats: null,
      currentPage: 1,
      totalPages: 1,
      totalPosts: 0,
      perPage: 20,
      filters: {},
      isLoading: false,
      isLoadingAccounts: false,
      isLoadingCategories: false,
      isLoadingPosts: false,
      error: null,
      lastUpdated: {
        accounts: 0,
        categories: 0,
        posts: 0,
        stats: 0
      },

      // Load Accounts
      loadAccounts: async () => {
        const state = get();

        // Check cache
        if (
          state.accounts.length > 0 &&
          Date.now() - state.lastUpdated.accounts < CACHE_DURATION
        ) {
          return;
        }

        set({ isLoadingAccounts: true, error: null });

        let retry = 0;
        while (retry < MAX_RETRIES) {
          try {
            const response = await apiClient.get('/social-media/accounts');

            if (!response.data.success) {
              throw new Error(response.data.error || 'Failed to load accounts');
            }

            set({
              accounts: response.data.data.accounts,
              isLoadingAccounts: false,
              lastUpdated: { ...state.lastUpdated, accounts: Date.now() }
            });
            return;
          } catch (error: any) {
            retry++;
            if (retry >= MAX_RETRIES) {
              set({
                error: error.message || 'Failed to load accounts',
                isLoadingAccounts: false
              });
            }
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retry) * 1000));
          }
        }
      },

      // Update Account
      updateAccount: async (id, data) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiClient.put(`/social-media/accounts/${id}`, data);

          if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to update account');
          }

          const updatedAccount = response.data.data;

          // Optimistic update
          set((state) => ({
            accounts: state.accounts.map((acc) => (acc.id === id ? updatedAccount : acc)),
            isLoading: false,
            lastUpdated: { ...state.lastUpdated, accounts: Date.now() }
          }));

          return updatedAccount;
        } catch (error: any) {
          set({
            error: error.message || 'Failed to update account',
            isLoading: false
          });
          throw error;
        }
      },

      // Load Categories
      loadCategories: async () => {
        const state = get();

        // Check cache
        if (
          state.categories.length > 0 &&
          Date.now() - state.lastUpdated.categories < CACHE_DURATION
        ) {
          return;
        }

        set({ isLoadingCategories: true, error: null });

        try {
          const response = await apiClient.get('/social-media/categories');

          if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to load categories');
          }

          set({
            categories: response.data.data.categories,
            isLoadingCategories: false,
            lastUpdated: { ...state.lastUpdated, categories: Date.now() }
          });
        } catch (error: any) {
          set({
            error: error.message || 'Failed to load categories',
            isLoadingCategories: false
          });
        }
      },

      // Create Category
      createCategory: async (data) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiClient.post('/social-media/categories', data);

          if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to create category');
          }

          const newCategory = response.data.data;

          // Optimistic update
          set((state) => ({
            categories: [...state.categories, newCategory],
            isLoading: false
          }));

          // Invalidate cache
          get().invalidateCache('categories');

          return newCategory;
        } catch (error: any) {
          set({
            error: error.message || 'Failed to create category',
            isLoading: false
          });
          throw error;
        }
      },

      // Load Posts
      loadPosts: async (options = {}) => {
        set({ isLoadingPosts: true, error: null });

        const state = get();
        const params = new URLSearchParams();

        params.append('page', (options.page || state.currentPage).toString());
        params.append('per_page', (options.per_page || state.perPage).toString());

        if (options.status || state.filters.status) {
          params.append('status', options.status || state.filters.status!);
        }
        if (options.category_id || state.filters.category_id) {
          params.append('category_id', (options.category_id || state.filters.category_id!).toString());
        }
        if (options.content_type || state.filters.content_type) {
          params.append('content_type', options.content_type || state.filters.content_type!);
        }
        if (options.search || state.filters.search) {
          params.append('search', options.search || state.filters.search!);
        }

        try {
          const response = await apiClient.get(`/social-media/posts?${params}`);

          if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to load posts');
          }

          const data: PostsResponse = response.data.data;

          set({
            posts: data.posts,
            currentPage: data.pagination.page,
            totalPages: data.pagination.pages,
            totalPosts: data.pagination.total,
            perPage: data.pagination.per_page,
            isLoadingPosts: false,
            lastUpdated: { ...state.lastUpdated, posts: Date.now() }
          });
        } catch (error: any) {
          set({
            error: error.message || 'Failed to load posts',
            isLoadingPosts: false
          });
        }
      },

      // Set Filters
      setFilters: (filters) => {
        set((state) => ({
          filters: { ...state.filters, ...filters },
          currentPage: 1  // Reset to first page when filters change
        }));

        // Auto-reload posts
        get().loadPosts();
      },

      // Clear Filters
      clearFilters: () => {
        set({ filters: {}, currentPage: 1 });
        get().loadPosts();
      },

      // Load Post by ID
      loadPostById: async (id) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiClient.get(`/social-media/posts/${id}`);

          if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to load post');
          }

          const post = response.data.data;
          set({ currentPost: post, isLoading: false });
          return post;
        } catch (error: any) {
          set({
            error: error.message || 'Failed to load post',
            isLoading: false
          });
          return null;
        }
      },

      // Create Post
      createPost: async (data) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiClient.post('/social-media/posts', data);

          if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to create post');
          }

          const newPost = response.data.data;

          // Optimistic update
          set((state) => ({
            posts: [newPost, ...state.posts],
            totalPosts: state.totalPosts + 1,
            isLoading: false
          }));

          // Invalidate cache and reload
          get().invalidateCache('posts');
          get().loadPosts();

          return newPost;
        } catch (error: any) {
          set({
            error: error.message || 'Failed to create post',
            isLoading: false
          });
          throw error;
        }
      },

      // Update Post
      updatePost: async (id, data) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiClient.put(`/social-media/posts/${id}`, data);

          if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to update post');
          }

          const updatedPost = response.data.data;

          // Optimistic update
          set((state) => ({
            posts: state.posts.map((p) => (p.id === id ? updatedPost : p)),
            currentPost: state.currentPost?.id === id ? updatedPost : state.currentPost,
            isLoading: false
          }));

          return updatedPost;
        } catch (error: any) {
          set({
            error: error.message || 'Failed to update post',
            isLoading: false
          });
          throw error;
        }
      },

      // Delete Post
      deletePost: async (id) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiClient.delete(`/social-media/posts/${id}`);

          if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to delete post');
          }

          // Optimistic update
          set((state) => ({
            posts: state.posts.filter((p) => p.id !== id),
            totalPosts: Math.max(0, state.totalPosts - 1),
            currentPost: state.currentPost?.id === id ? null : state.currentPost,
            isLoading: false
          }));

          // Reload to sync pagination
          get().loadPosts();
        } catch (error: any) {
          set({
            error: error.message || 'Failed to delete post',
            isLoading: false
          });
          throw error;
        }
      },

      // Set Current Post
      setCurrentPost: (post) => {
        set({ currentPost: post });
      },

      // Load Stats
      loadStats: async () => {
        const state = get();

        // Check cache
        if (state.stats && Date.now() - state.lastUpdated.stats < CACHE_DURATION) {
          return;
        }

        try {
          const response = await apiClient.get('/social-media/stats');

          if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to load stats');
          }

          set({
            stats: response.data.data,
            lastUpdated: { ...state.lastUpdated, stats: Date.now() }
          });
        } catch (error: any) {
          // Stats non critici, log only
          console.warn('Failed to load stats:', error);
        }
      },

      // Invalidate Cache
      invalidateCache: (type = 'all') => {
        set((state) => {
          const newLastUpdated = { ...state.lastUpdated };

          if (type === 'all') {
            newLastUpdated.accounts = 0;
            newLastUpdated.categories = 0;
            newLastUpdated.posts = 0;
            newLastUpdated.stats = 0;
          } else {
            newLastUpdated[type] = 0;
          }

          return { lastUpdated: newLastUpdated };
        });
      },

      // Reset Error
      resetError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'social-media-store',
      partialize: (state) => ({
        accounts: state.accounts,
        categories: state.categories,
        lastUpdated: state.lastUpdated,
        filters: state.filters,
        perPage: state.perPage
      })
    }
  )
);
