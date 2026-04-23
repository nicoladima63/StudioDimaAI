import apiClient from '@/services/api/client';

export interface SeoIssue {
  severity: string;
  category: string;
  message: string;
  recommendation?: string;
  type?: string;
}

export interface SeoCategory {
  label: string;
  score: number;
  weight: string;
  issues_count: number;
  data: Record<string, any>;
  issues?: SeoIssue[];
}

export interface SeoAuditResult {
  url: string;
  overall_score: number;
  score_label: string;
  elapsed_seconds: number;
  categories: Record<string, SeoCategory>;
  issues: SeoIssue[];
  issues_summary: Record<string, number>;
  quick_wins: SeoIssue[];
  success: boolean;
  error?: string;
}

export interface CorrectionItem {
  severity: string;
  action: string;
  reason: string;
  example?: string;
}

export interface SavedAudit {
  domain: string;
  url: string;
  score: number;
  score_label: string;
  timestamp: string;
}

export interface CompetitorEntry {
  url: string;
  score?: number;
  score_label?: string;
  error?: string;
}

export interface CompetitorResult {
  success: boolean;
  analyzed: number;
  failed: number;
  competitors: CompetitorEntry[];
  corrections: CorrectionItem[];
  my_position?: number | null;
  warning?: string;
  error?: string;
}

export const seoService = {
  async apiRunAudit(url: string): Promise<SeoAuditResult> {
    const response = await apiClient.post('seo/audit', { url });
    return response.data.data;
  },

  async apiQuickCheck(url: string): Promise<any> {
    const response = await apiClient.post('seo/quick-check', { url });
    return response.data.data;
  },

  async apiCompetitorAnalysis(domain: string, keywords: string): Promise<CompetitorResult> {
    const response = await apiClient.post('seo/competitors', { domain, keywords });
    return response.data.data;
  },

  async apiLoadAudit(domain: string): Promise<SeoAuditResult> {
    const response = await apiClient.get(`seo/audits/${domain}`);
    return response.data.data;
  },

  async apiListAudits(): Promise<SavedAudit[]> {
    const response = await apiClient.get('seo/audits');
    return response.data.data || [];
  },
};

export default seoService;
