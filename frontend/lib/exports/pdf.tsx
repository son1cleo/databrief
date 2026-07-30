import "server-only";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { StoryBlock, Chapter } from "@/lib/llm/schemas";
import { accentFor, chartDataUri, type NarrationExportData } from "./types";
import { parseInlineMarkdown } from "@/lib/markdown";

const styles = StyleSheet.create({
  page: {
    paddingTop: 70,
    paddingBottom: 70,
    paddingHorizontal: 56,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
    fontSize: 12,
    lineHeight: 1.6,
  },
  brandHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 2,
  },
  brandLogo: { height: 32 },
  brandName: { fontSize: 13, fontWeight: 600, color: "#6b7280" },
  eyebrow: { fontSize: 9, fontWeight: 700, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", marginBottom: 18, gap: 10 },
  datasetId: { fontSize: 10, color: "#6b7280" },
  confidenceBadge: { fontSize: 10, fontWeight: 700, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 3 },
  headline: { fontSize: 28, marginBottom: 10, fontWeight: 700, lineHeight: 1.25 },
  hook: { fontSize: 13, marginBottom: 20, lineHeight: 1.6, color: "#374151", fontStyle: "italic", borderLeftWidth: 2, paddingLeft: 14 },
  focusCallout: { marginBottom: 20, padding: 16, borderRadius: 6, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#f9fafb" },
  focusCalloutLabel: { fontSize: 9, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 },
  focusCalloutQuestion: { fontSize: 12, fontWeight: 600, marginBottom: 8, lineHeight: 1.5 },
  focusCalloutText: { fontSize: 12, lineHeight: 1.5, color: "#374151" },
  // lineHeight must be set explicitly here, not inherited from `page` — when
  // inherited, React-PDF carries down the *computed* line height in points
  // rather than the multiplier, which is far too tight once fontSize jumps
  // from 12px to 28px and causes wrapped heading lines to overlap.
  chapterTitle: { fontSize: 19, marginBottom: 12, fontWeight: 700, lineHeight: 1.3 },
  chapterSection: { marginTop: 30, paddingTop: 24, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  chapterSectionFirst: { marginTop: 30 },
  subheading1: { fontSize: 15, marginTop: 16, marginBottom: 8, fontWeight: 700, lineHeight: 1.3 },
  subheading2: { fontSize: 13, marginTop: 12, marginBottom: 6, fontWeight: 700, lineHeight: 1.3 },
  p: { fontSize: 12, marginBottom: 12, lineHeight: 1.6 },
  listItem: { fontSize: 12, marginBottom: 6, paddingLeft: 16 },
  chartCard: { marginVertical: 14, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#fafafa", alignItems: "center" },
  chartImage: { width: 320 },
  actionsBox: { marginTop: 32, padding: 20, borderRadius: 8, borderWidth: 1 },
  actionsTitle: { fontSize: 14, fontWeight: 700, marginBottom: 12 },
  implicationText: { fontSize: 12, marginBottom: 14, lineHeight: 1.6, color: "#374151" },
  actionItem: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 10 },
  actionBadge: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  actionNumber: { fontSize: 10, fontWeight: 700 },
  actionText: { fontSize: 12, flex: 1, lineHeight: 1.5 },
  footer: { marginTop: 48, fontSize: 10, color: "#9ca3af" },
});

/** Converts a brand hex color (e.g. "#3b82f6") to an rgba() string at the
 * given alpha, so per-brand accent colors (arbitrary hex, not a fixed
 * palette) can produce the same light-tint card/badge treatments the
 * frontend gets for free from Tailwind's `/5`/`/20` opacity modifiers --
 * React-PDF styles don't support that syntax. Falls back to a neutral gray
 * tint if the color can't be parsed rather than rendering "rgba(NaN,...)". */
function tint(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return `rgba(107, 114, 128, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Narrated text is light Markdown. Nested <Text> inherits the surrounding
 * style, so each run only overrides what its own marks change -- bold inside
 * an already-bold heading stays bold, italic inside the hook stays italic. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {parseInlineMarkdown(text).map((token, i) => (
        <Text
          key={i}
          style={{
            fontWeight: token.bold ? 700 : undefined,
            fontStyle: token.italic ? "italic" : undefined,
            fontFamily: token.code ? "Courier" : undefined,
            color: token.href ? "#2563eb" : undefined,
            textDecoration: token.strike ? "line-through" : token.href ? "underline" : undefined,
          }}
        >
          {token.text}
        </Text>
      ))}
    </>
  );
}

function Blocks({ blocks, findings, accent }: { blocks: StoryBlock[]; findings: NarrationExportData["findings"]; accent: string }) {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          return (
            <Text key={i} style={[block.level === 1 ? styles.subheading1 : styles.subheading2, { color: accent }]}>
              <Rich text={block.text} />
            </Text>
          );
        }
        if (block.type === "paragraph") {
          return (
            <Text key={i} style={styles.p}>
              <Rich text={block.text} />
            </Text>
          );
        }
        if (block.type === "list") {
          return (
            <View key={i} style={{ marginBottom: 12 }}>
              {block.items.map((item, j) => (
                <Text key={j} style={styles.listItem}>
                  • <Rich text={item} />
                </Text>
              ))}
            </View>
          );
        }
        // chart
        const uri = chartDataUri(findings, block.findingRef);
        return uri ? (
          <View key={i} style={styles.chartCard}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt prop; matches the existing brand-logo Image above */}
            <Image src={uri} style={styles.chartImage} />
          </View>
        ) : null;
      })}
    </>
  );
}

function ChapterSection({
  chapter,
  findings,
  accent,
  isFirst,
}: {
  chapter: Chapter;
  findings: NarrationExportData["findings"];
  accent: string;
  isFirst: boolean;
}) {
  if (chapter.blocks.length === 0) return null;
  return (
    <View style={isFirst ? styles.chapterSectionFirst : styles.chapterSection}>
      <Text style={[styles.chapterTitle, { color: accent }]}>
        <Rich text={chapter.title} />
      </Text>
      <Blocks blocks={chapter.blocks} findings={findings} accent={accent} />
    </View>
  );
}

function confidenceColor(score: number): string {
  if (score >= 75) return "#15803d";
  if (score >= 50) return "#b45309";
  return "#b91c1c";
}

function ReportDocument({ metadata, narration, findings, brand }: NarrationExportData) {
  const accent = accentFor(brand);
  const showLogo = brand.isBranded && brand.logoUrl;
  const showBrandName = !showLogo;
  const hasActions = narration.actions.length > 0 || Boolean(narration.implication);
  const firstNonEmptyChapterId = narration.chapters.find((c) => c.blocks.length > 0)?.id;

  return (
    <Document title={metadata.title}>
      <Page size="A4" style={styles.page}>
        <View style={[styles.brandHeader, { borderBottomColor: accent }]}>
          {showLogo ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={brand.logoUrl as string} style={styles.brandLogo} />
          ) : showBrandName ? (
            <Text style={styles.brandName}>DataBrief</Text>
          ) : null}
        </View>

        <Text style={styles.eyebrow}>Executive Data Brief</Text>
        <View style={styles.metaRow}>
          <Text style={styles.datasetId}>{metadata.datasetLabel}</Text>
          {metadata.dataConfidence !== null && (
            <Text
              style={[
                styles.confidenceBadge,
                { color: confidenceColor(metadata.dataConfidence), backgroundColor: "#f3f4f6" },
              ]}
            >
              Data Confidence: {metadata.dataConfidence}%
            </Text>
          )}
        </View>

        <Text style={[styles.headline, { color: accent }]}>
          <Rich text={narration.headline} />
        </Text>
        <Text style={[styles.hook, { borderLeftColor: accent }]}>
          <Rich text={narration.hook} />
        </Text>

        {metadata.question && narration.focusQuestionCallout && (
          <View style={styles.focusCallout}>
            <Text style={[styles.focusCalloutLabel, { color: accent }]}>Focus Question</Text>
            <Text style={styles.focusCalloutQuestion}>{metadata.question}</Text>
            <Text style={styles.focusCalloutText}>
              <Rich text={narration.focusQuestionCallout} />
            </Text>
          </View>
        )}

        {narration.chapters.map((chapter) => (
          <ChapterSection
            key={chapter.id}
            chapter={chapter}
            findings={findings}
            accent={accent}
            isFirst={chapter.id === firstNonEmptyChapterId}
          />
        ))}

        {hasActions && (
          <View style={[styles.actionsBox, { backgroundColor: tint(accent, 0.05), borderColor: tint(accent, 0.2) }]}>
            <Text style={[styles.actionsTitle, { color: accent }]}>Strategic Actions</Text>
            {narration.implication && (
              <Text style={styles.implicationText}>
                <Rich text={narration.implication} />
              </Text>
            )}
            {narration.actions.map((action, i) => (
              <View key={i} style={styles.actionItem}>
                <View style={[styles.actionBadge, { backgroundColor: tint(accent, 0.15) }]}>
                  <Text style={[styles.actionNumber, { color: accent }]}>{i + 1}</Text>
                </View>
                <Text style={styles.actionText}>
                  <Rich text={action} />
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footer}>Generated by DataBrief</Text>
      </Page>
    </Document>
  );
}

export async function renderReportPdf(data: NarrationExportData): Promise<Buffer> {
  return renderToBuffer(<ReportDocument {...data} />);
}
