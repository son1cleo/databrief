import {
  Landmark,
  ShoppingCart,
  HeartPulse,
  Building2,
  Truck,
  Megaphone,
  Cpu,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

export interface Industry {
  key: string;
  label: string;
  icon: LucideIcon;
}

export const INDUSTRIES: Industry[] = [
  { key: "finance", label: "Finance", icon: Landmark },
  { key: "retail", label: "Retail", icon: ShoppingCart },
  { key: "healthcare", label: "Healthcare", icon: HeartPulse },
  { key: "real_estate", label: "Real Estate", icon: Building2 },
  { key: "logistics", label: "Logistics", icon: Truck },
  { key: "marketing", label: "Marketing", icon: Megaphone },
  { key: "tech", label: "Tech", icon: Cpu },
  { key: "other", label: "Other", icon: MoreHorizontal },
];

export interface PptxTheme {
  key: string;
  label: string;
  description: string;
  background: string;
  accent: string;
  font: string;
}

export const PPTX_THEMES: PptxTheme[] = [
  {
    key: "boardroom",
    label: "Boardroom",
    description: "Dark navy, sharp, minimal",
    background: "#0a0f1e",
    accent: "#2563eb",
    font: "Arial",
  },
  {
    key: "consulting",
    label: "Consulting",
    description: "White, grid layout, McKinsey-style",
    background: "#ffffff",
    accent: "#1a1a2e",
    font: "Calibri",
  },
  {
    key: "startup",
    label: "Startup",
    description: "Bold colors, big numbers",
    background: "#0a0a0a",
    accent: "#f97316",
    font: "Inter",
  },
  {
    key: "editorial",
    label: "Editorial",
    description: "Magazine layout, story-forward",
    background: "#fafaf8",
    accent: "#7c3aed",
    font: "Georgia",
  },
  {
    key: "academic",
    label: "Academic",
    description: "Clean, neutral, citation-friendly",
    background: "#ffffff",
    accent: "#374151",
    font: "Times New Roman",
  },
];
