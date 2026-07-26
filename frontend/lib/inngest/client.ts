import "server-only";
import { Inngest } from "inngest";

export interface GenerateReportEventData {
  reportId: string;
  industry: string | null;
  question: string | null;
  formats: string[];
}

export const GENERATE_REPORT_EVENT = "report/generate.requested";

export const inngest = new Inngest({ id: "databrief" });
