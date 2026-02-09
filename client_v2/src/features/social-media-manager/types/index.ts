/**
 * TypeScript interfaces per Social Media Manager - MVP Phase 1
 */

export interface SocialAccount {
  id: number;
  platform: 'instagram' | 'facebook' | 'linkedin' | 'tiktok';
  account_name: string;
  account_username?: string;
  account_id?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  is_connected: boolean;
  connection_status: 'connected' | 'disconnected';
  last_synced_at?: string;
  metadata?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Post {
  id: number;
  category_id?: number;
  title: string;
  content: string;
  content_type: 'post' | 'newsletter' | 'email_team' | 'announcement' | 'procedure';
  platforms: string[];
  media_urls: string[];
  hashtags: string[];
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduled_at?: string;
  published_at?: string;
  created_by?: number;
  metadata?: Record<string, any>;
  template_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PostsStats {
  total: number;
  draft: number;
  scheduled: number;
  published: number;
}

export interface PaginationInfo {
  page: number;
  per_page: number;
  total: number;
  pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PostsResponse {
  posts: Post[];
  pagination: PaginationInfo;
}

export interface CreatePostRequest {
  title: string;
  content: string;
  category_id?: number | null;
  content_type?: string;
  platforms?: string[];
  media_urls?: string[];
  hashtags?: string[];
  scheduled_at?: string | null;
  status?: string;
}

export interface UpdatePostRequest {
  title?: string;
  content?: string;
  category_id?: number | null;
  content_type?: string;
  platforms?: string[];
  media_urls?: string[];
  hashtags?: string[];
  status?: string;
  scheduled_at?: string | null;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  sort_order?: number;
}
