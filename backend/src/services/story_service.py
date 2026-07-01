from typing import Any

from src.services.analysis_service import Finding

IMPLICATION_TEMPLATES = {
    "ranking": "A clear leader has emerged -- but the gap between first and the rest tells its own story.",
    "dose_response": "There is an optimal level -- both too little and too much may be counterproductive.",
    "outlier": "A handful of records are skewing the picture -- worth checking whether they're errors or genuinely exceptional cases.",
    "trend": "The direction of this trend, if it continues, will materially change the numbers that matter.",
    "correlation": "This relationship suggests one of these factors may be driving the other -- or both are being pulled by something else.",
    "distribution": "Most of the value (or risk) is concentrated in a small slice of the data, not spread evenly.",
    "descriptive": "This baseline is the yardstick everything else in the dataset should be measured against.",
    "data_quality": "Gaps in the data limit how much confidence to place in any single number here.",
}

ACTION_TEMPLATES = {
    "ranking": "Focus on what the top performers share, and whether those traits can be replicated.",
    "dose_response": "Identify the sweet spot range and design interventions that keep usage within it.",
    "outlier": "Investigate the flagged records individually before drawing conclusions from the averages.",
    "trend": "Decide whether to reinforce or reverse this trajectory, and set a checkpoint to re-measure it.",
    "correlation": "Test whether the relationship holds outside this dataset before acting on it.",
    "distribution": "Segment the analysis so the dominant values don't drown out the rest of the story.",
    "descriptive": "Use this range as the baseline for future comparisons.",
    "data_quality": "Improve data collection in the gaps before relying on this dataset for high-stakes decisions.",
}


def build_dataset_context(row_count: int | None, column_count: int | None, columns: list[str]) -> str:
    parts = []
    if row_count is not None and column_count is not None:
        parts.append(f"This dataset contains {row_count:,} rows and {column_count} columns")
    if columns:
        shown = ", ".join(columns[:8])
        more = f", and {len(columns) - 8} more" if len(columns) > 8 else ""
        parts.append(f"covering {shown}{more}")
    return " ".join(parts) + "." if parts else "Dataset overview unavailable."


def _question_hook(findings: list[Finding], question: str | None) -> str:
    """Build the opening hook. Dose-response and ranking findings answer the question
    directly. Change-column findings are never used as hooks."""
    clean = [f for f in findings if not any(c.startswith("change_") for c in f.columns)]

    if not question:
        return clean[0].description if clean else (findings[0].description if findings else "Your data has a story to tell.")

    dose = [f for f in findings if f.type == "dose_response"]
    if dose:
        top = dose[0]
        x = top.extra.get("independent_var", "").replace("_", " ")
        pattern = top.extra.get("pattern", "")
        outcome = top.extra.get("outcome_label", "performance")
        peak_bucket = top.extra.get("peak_bucket")
        if pattern == "inverted_u" and peak_bucket:
            return f"Yes -- but only up to a point. {x.title()} peaks at {peak_bucket} usage, then hurts more than it helps"
        if pattern == "linear_positive":
            return f"Yes -- more {x} consistently improves {outcome}"
        if pattern == "linear_negative":
            return f"Surprisingly, more {x} is associated with worse {outcome}"
        return top.description

    ranking = [f for f in findings if f.type == "ranking"]
    if ranking:
        top = ranking[0]
        entity = top.extra.get("top_entity", "")
        val = top.extra.get("top_value", 0)
        if top.extra.get("is_combined"):
            combined_cols = top.extra.get("combined_cols", [])
            readable = " + ".join(c.replace("_", " ").replace("tournament", "").strip() for c in combined_cols)
            return f"{entity} leads in combined {readable} with {val:,.0f} total contributions"
        col = top.extra.get("col", top.columns[-1] if top.columns else "")
        return f"{entity} has the highest {col} in this dataset with {val:,.0f}"

    return clean[0].description if clean else (findings[0].description if findings else "Your data has a story to tell.")


def build_story_arc(
    findings: list[Finding],
    row_count: int | None,
    column_count: int | None,
    columns: list[str],
    question: str | None = None,
) -> dict[str, Any]:
    """Assembles the pre-computed story arc JSON the LLM (or fallback writer)
    narrates. No new facts are invented here — only structure and framing."""
    if not findings:
        return {
            "hook": "This dataset didn't surface any statistically notable findings.",
            "context": build_dataset_context(row_count, column_count, columns),
            "findings": [],
            "climax": None,
            "implication": "More data or a different cut may be needed to find a story here.",
            "action": "Try uploading a richer dataset or asking a more specific question.",
            "open_question": None,
            "question": question,
        }

    # Dose-response findings are the climax when present; otherwise highest magnitude
    # Never let a derived change_ column finding dominate the climax
    dose_findings = [f for f in findings if f.type == "dose_response"]
    non_change = [f for f in findings if not any(c.startswith("change_") for c in f.columns)]
    climax_pool = dose_findings or non_change or findings
    climax = max(climax_pool, key=lambda f: f.magnitude)

    return {
        "hook": _question_hook(findings, question),
        "context": build_dataset_context(row_count, column_count, columns),
        "findings": [f.to_dict() for f in findings],
        "climax": climax.to_dict(),
        "implication": IMPLICATION_TEMPLATES.get(climax.type, IMPLICATION_TEMPLATES["descriptive"]),
        "action": ACTION_TEMPLATES.get(climax.type, ACTION_TEMPLATES["descriptive"]),
        "open_question": (
            f"What else might explain {question.rstrip('?')}?" if question
            else (f"What's behind {', '.join(findings[1].columns)}?" if len(findings) > 1 else None)
        ),
        "question": question,
    }


def build_text_story_arc(text: str, question: str | None = None) -> dict[str, Any]:
    """For unstructured uploads (PDF/DOCX/TXT/image) — no pre-computed Findings
    exist, so the raw extracted text is handed to the LLM to find the
    interesting angle itself rather than narrating fabricated statistics."""
    word_count = len(text.split())
    return {
        "hook": "Here's what stood out in this document.",
        "context": f"This document contains approximately {word_count:,} words.",
        "findings": [],
        "climax": None,
        "implication": "",
        "action": "",
        "open_question": None,
        "question": question,
        "raw_text": text[:8000],
    }
