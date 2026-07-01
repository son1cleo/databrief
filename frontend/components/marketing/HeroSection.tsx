"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const TERMINAL_LINES = [
  { delay: 0, text: "> loading Q3_revenue.csv", type: "cmd" },
  { delay: 600, text: "  detected: 885 rows × 12 columns", type: "info" },
  { delay: 1200, text: "  running analysis_engine v1.0...", type: "info" },
  { delay: 2000, text: "  ████████████████░░░░  84%", type: "progress" },
  { delay: 2800, text: "", type: "blank" },
  { delay: 3000, text: "FINDING #1 — UNEXPECTED", type: "heading" },
  { delay: 3400, text: "Revenue dropped 34% in August.", type: "story" },
  { delay: 4000, text: "But only on Tuesdays and Thursdays.", type: "story" },
  { delay: 4800, text: "Every other day performed normally.", type: "story" },
  { delay: 5600, text: "", type: "blank" },
  { delay: 5800, text: "The drop started exactly 3 days", type: "story" },
  { delay: 6400, text: "after your last price change.", type: "story" },
  { delay: 7200, text: "", type: "blank" },
  { delay: 7400, text: "That's probably not a coincidence_", type: "story" },
];

function TerminalCard() {
  const [visibleLines, setVisibleLines] = useState<number[]>([]);

  useEffect(() => {
    const timers = TERMINAL_LINES.map((line, i) =>
      setTimeout(() => {
        setVisibleLines((prev) => [...prev, i]);
      }, line.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="glow-brand relative overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="size-3 rounded-full bg-[#ff5f57]" />
        <span className="size-3 rounded-full bg-[#ffbd2e]" />
        <span className="size-3 rounded-full bg-[#28c840]" />
        <span className="ml-3 font-mono text-xs text-muted-foreground">
          databrief — analysis
        </span>
      </div>

      <div className="min-h-[280px] space-y-1 px-5 py-4">
        {TERMINAL_LINES.map((line, i) => (
          <div
            key={i}
            className={`font-mono text-xs leading-relaxed transition-opacity duration-300 ${
              visibleLines.includes(i) ? "opacity-100" : "opacity-0"
            } ${
              line.type === "cmd"
                ? "text-data-ink"
                : line.type === "heading"
                  ? "mt-2 font-medium text-foreground"
                  : line.type === "progress"
                    ? "text-success"
                    : line.type === "story"
                      ? "text-foreground/80"
                      : line.type === "info"
                        ? "text-muted-foreground"
                        : "h-2"
            }`}
          >
            {line.text}
            {i === TERMINAL_LINES.length - 1 && visibleLines.includes(i) && (
              <span className="cursor-blink" />
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-border px-5 py-3">
        <svg width="100%" height="32" viewBox="0 0 400 32" preserveAspectRatio="none">
          <polyline
            points="0,16 30,10 60,22 90,8 120,20 150,12 180,24 210,6 240,18 270,10 300,22 330,14 360,20 400,16"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.5"
            opacity="0.6"
          />
        </svg>
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center pt-14">
      <div className="mx-auto w-full max-w-7xl px-6 py-24">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
          <div className="relative">
            <span className="data-label absolute -top-8 left-0 hidden select-none lg:block">
              n = 885
            </span>
            <span className="data-label absolute top-24 -left-8 hidden select-none xl:block">
              σ = 2.4
            </span>

            <div className="mb-8 inline-flex items-center gap-2 rounded border border-border bg-surface px-3 py-1.5">
              <span className="size-1.5 animate-pulse rounded-full bg-success" />
              <span className="font-mono text-xs text-muted-foreground">
                analysis_engine v1.0 — running
              </span>
            </div>

            <h1 className="mb-6 font-display text-[clamp(42px,6vw,80px)] leading-[1.0] font-extrabold tracking-[-0.03em] text-foreground">
              Your data knows
              <br />
              something
              <br />
              <span className="text-data-ink">you don&apos;t.</span>
            </h1>

            <p className="mb-10 max-w-md font-sans text-base leading-relaxed text-muted-foreground">
              Upload any spreadsheet, PDF, or document. DataBrief finds what&apos;s
              surprising and writes it as a story — delivered as PDF, Word, or a branded deck.
            </p>

            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="glow-brand-hover rounded bg-brand px-5 py-2.5 font-mono text-sm text-white transition-all hover:bg-brand-hover"
              >
                Find out what →
              </Link>
              <Link
                href="#features"
                className="rounded border border-border px-5 py-2.5 font-mono text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                See how it works
              </Link>
            </div>

            <div className="mt-14 flex items-center gap-6 border-t border-border pt-6">
              <div>
                <p className="font-mono text-xs text-muted-foreground">COMPANIES</p>
                <p className="font-display text-2xl font-bold text-foreground">885+</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="font-mono text-xs text-muted-foreground">INDUSTRIES</p>
                <p className="font-display text-2xl font-bold text-foreground">10</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="font-mono text-xs text-muted-foreground">YEARS</p>
                <p className="font-display text-2xl font-bold text-foreground">2009–23</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <span className="data-label absolute -top-5 right-4 hidden select-none sm:block">
              p &lt; 0.01
            </span>
            <span className="data-label absolute -right-6 bottom-4 hidden select-none xl:block">
              r² = 0.84
            </span>
            <TerminalCard />
          </div>
        </div>
      </div>
    </section>
  );
}
