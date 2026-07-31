import "server-only";
import { configuredProviders } from "@/lib/llm/providers";
import { runWithFallback } from "@/lib/llm/fallbackGraph";
import {
  generatedQuestionsSchema,
  multiQuestionPlanSchema,
  MAX_QUESTIONS,
  type MultiQuestionPlan,
  type QuestionPlanEntry,
} from "@/lib/llm/schemas";
import { buildHeuristicPlan, type ColumnSummary, type Row } from "@/lib/analysis";

function columnContext(columns: string[], profile: ColumnSummary[]): string {
  return JSON.stringify(
    columns.map((name) => profile.find((p) => p.name === name) ?? { name }),
    null,
    2
  );
}

const AUTO_QUESTIONS_PROMPT = `You are a data analyst. A user uploaded a dataset without asking a specific \
question. Your job is to propose the handful of questions this dataset is best positioned to answer -- the ones \
a real stakeholder in this industry would actually want answered, not generic statistics trivia.

Rules:
- Propose 2-4 questions, most valuable first.
- Phrase each question the way a business stakeholder would ask it out loud, not as a statistics term \
("Which product line is most profitable?" not "What is the mean revenue by category?").
- Favor questions that surface a real decision, risk, or opportunity over ones with an obviously trivial answer.
- Only ask about columns that actually exist in this dataset.`;

/** Proposes the dataset's most valuable questions when the user didn't ask
 * one, so the rest of the pipeline (planQuestions -> analyze -> narrate) has
 * something concrete to structure the report around instead of falling back
 * to a generic, dataset-wide summary. Returns [] on any failure -- the
 * caller treats that exactly like "still no questions" (forces the
 * narration context-chapter path, see lib/llm/narrationAgent.ts). */
export async function generateAutoQuestions(
  columns: string[],
  profile: ColumnSummary[],
  sampleRows: Row[],
  industry: string | null,
  preferredProvider?: string | null
): Promise<string[]> {
  const providers = configuredProviders(preferredProvider);
  if (providers.length === 0) return [];

  const userMessage = `Industry: ${industry || "general business"}

Columns:
${columnContext(columns, profile)}

Sample rows:
${JSON.stringify(sampleRows.slice(0, 5), null, 2)}`;

  const outcome = await runWithFallback(providers, AUTO_QUESTIONS_PROMPT, userMessage, generatedQuestionsSchema);
  if (outcome.result === null) return [];
  return outcome.result.questions.map((q) => q.trim()).filter(Boolean).slice(0, 4);
}

const AUTO_QUESTIONS_TEXT_PROMPT = `You are a data analyst. A user uploaded a document without asking a specific \
question. Your job is to propose the handful of questions this document is best positioned to answer -- the ones \
a real reader would actually want answered.

Rules:
- Propose 2-4 questions, most valuable first.
- Phrase each question the way a reader would ask it out loud.
- Only ask about things actually present in the document.`;

/** Text-upload equivalent of generateAutoQuestions() -- no columns/profile
 * exist for a raw document, so this works directly off the extracted text. */
export async function generateAutoQuestionsFromText(
  text: string,
  industry: string | null,
  preferredProvider?: string | null
): Promise<string[]> {
  const providers = configuredProviders(preferredProvider);
  if (providers.length === 0) return [];

  const userMessage = `Industry: ${industry || "general business"}\n\nDocument text:\n${text.slice(0, 6000)}`;
  const outcome = await runWithFallback(providers, AUTO_QUESTIONS_TEXT_PROMPT, userMessage, generatedQuestionsSchema);
  if (outcome.result === null) return [];
  return outcome.result.questions.map((q) => q.trim()).filter(Boolean).slice(0, 4);
}

const PLAN_PROMPT = `You are a data analyst. A user uploaded a dataset and asked one or more questions. For EACH \
question, decide how to answer it using the dataset -- before any analysis runs.

For each question, produce a plan entry:
- questionIndices: normally just that question's own index. Only group two or more indices together when the \
questions are similar enough to answer in a single combined section -- don't over-cluster distinct questions.
- answerable: false if the dataset's columns genuinely cannot answer it (say why in unanswerableReason).
- relevant_cols: the 2-6 columns actually needed.
- independent_var / dependent_var: set both when the question is about whether one variable drives another \
(e.g. "does more X improve Y?"), otherwise null.
- tools: pick ONLY the tools that help answer this specific question, from:
  - descriptive: basic stats (mean/range) for a relevant numeric column
  - trend: how a numeric column changed over time
  - outlier: extreme/unusual values in a relevant column
  - correlation: relationship between two numeric columns
  - distribution: skew/concentration of a numeric column
  - ranking: who/what has the most/highest/best
  - comparison: how groups/categories differ
  - dose_response: whether more of X changes Y, including whether there's a sweet spot
- depth: "brief" for a simple factual question, "standard" for most questions, "deep" for a question that clearly \
wants thorough investigation (multiple angles, a strong claim to verify, high stakes).

Produce one entry per question (or per cluster of similar questions) -- do not skip any question index.`;

/** Validates the model's plan against reality (columns that actually exist,
 * question indices in range) and guarantees every question index ends up
 * covered by exactly one entry -- if the model silently dropped a question,
 * it gets a heuristic single-question entry rather than being narrated as if
 * it were never asked. */
function sanitizePlan(plan: MultiQuestionPlan, questions: string[], columns: string[], numericCols: string[]): QuestionPlanEntry[] {
  const columnSet = new Set(columns);
  const claimed = new Set<number>();
  const entries: QuestionPlanEntry[] = [];

  for (const raw of plan.entries) {
    const questionIndices = Array.from(new Set(raw.questionIndices.filter((i) => i >= 0 && i < questions.length && !claimed.has(i))));
    if (questionIndices.length === 0) continue;
    questionIndices.forEach((i) => claimed.add(i));
    entries.push({
      questionIndices,
      answerable: raw.answerable,
      unanswerableReason: raw.answerable ? null : raw.unanswerableReason,
      relevant_cols: raw.relevant_cols.filter((c) => columnSet.has(c)),
      independent_var: raw.independent_var && columnSet.has(raw.independent_var) ? raw.independent_var : null,
      dependent_var: raw.dependent_var && columnSet.has(raw.dependent_var) ? raw.dependent_var : null,
      tools: raw.tools,
      depth: raw.depth,
    });
  }

  const missing = questions.map((_, i) => i).filter((i) => !claimed.has(i));
  if (missing.length > 0) {
    const heuristic = buildHeuristicPlan(missing.map((i) => questions[i]), columns, numericCols);
    heuristic.forEach((entry, localIdx) => entries.push({ ...entry, questionIndices: [missing[localIdx]] }));
  }

  return entries.slice(0, MAX_QUESTIONS);
}

/** Decides, per question, whether the dataset can answer it and which of the
 * deterministic tools in lib/analysis.ts to run -- replaces the old
 * single-question column-relevance classifier. Falls back to
 * buildHeuristicPlan() (reusing the pre-redesign keyword heuristics) when no
 * provider is configured or the call fails outright. */
export async function planQuestions(
  questions: string[],
  columns: string[],
  profile: ColumnSummary[],
  preferredProvider?: string | null
): Promise<QuestionPlanEntry[]> {
  const numericCols = profile.filter((p) => p.kind === "numeric").map((p) => p.name);
  const providers = configuredProviders(preferredProvider);
  if (providers.length === 0) return buildHeuristicPlan(questions, columns, numericCols);

  const userMessage = `Questions:
${questions.map((q, i) => `${i}. ${q}`).join("\n")}

Columns:
${columnContext(columns, profile)}`;

  const outcome = await runWithFallback(providers, PLAN_PROMPT, userMessage, multiQuestionPlanSchema);
  if (outcome.result === null) return buildHeuristicPlan(questions, columns, numericCols);

  const entries = sanitizePlan(outcome.result, questions, columns, numericCols);
  return entries.length > 0 ? entries : buildHeuristicPlan(questions, columns, numericCols);
}
