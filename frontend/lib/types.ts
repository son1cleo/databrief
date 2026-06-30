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
