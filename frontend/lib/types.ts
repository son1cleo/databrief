export interface UserOut {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  provider: string | null;
  plan: string;
  reports_used: number;
  reports_limit: number;
  industry: string | null;
  onboarded: number;
  brand_logo_url: string | null;
  brand_primary: string | null;
  brand_secondary: string | null;
  brand_font: string | null;
  default_pptx_theme: string | null;
  created_at: string;
}

export interface UploadPreview {
  upload_id: string;
  columns: string[];
  rows: Record<string, string>[];
  text_preview: string | null;
  file_type: string;
  data_type: string;
  row_count: number | null;
  column_count: number | null;
}

export interface ReportConfigRequest {
  upload_id: string;
  formats: string[];
  pptx_theme?: string;
  apply_brand_kit?: boolean;
  industry?: string;
  question?: string;
}

export interface ReportOut {
  id: string;
  user_id: string;
  upload_id: string;
  title: string | null;
  hook: string | null;
  story_json: Record<string, unknown> | null;
  story_html: string | null;
  word_count: number | null;
  findings_count: number | null;
  status: string;
  error_message: string | null;
  pptx_theme: string | null;
  is_branded: boolean;
  created_at: string;
  updated_at: string;
}
