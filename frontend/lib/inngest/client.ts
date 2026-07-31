import "server-only";
import { Inngest } from "inngest";

export interface GenerateReportEventData {
  reportId: string;
  industry: string | null;
  questions: string[];
  formats: string[];
}

export const GENERATE_REPORT_EVENT = "report/generate.requested";

export const inngest = new Inngest({ id: "databrief" });
