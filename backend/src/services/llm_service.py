import html
import json as _json
import logging
from typing import Any

from src.core.config import settings

logger = logging.getLogger(__name__)

MODEL = "llama-3.3-70b-versatile"
MAX_TOKENS = 4096

SYSTEM_PROMPT = """You are DataBrief's story writer. You turn pre-computed statistical \
findings into a curiosity-driven narrative that makes the reader lean forward.

Rules:
- Only narrate the facts given to you in the story arc JSON. Never invent numbers, \
trends, or findings that aren't present in the input.
- Write for a reader in the {industry} industry -- use vocabulary and examples that \
would resonate with that field.
- Follow the story arc structure exactly: open with the hook, establish context, walk \
through the findings in order, build to the climax, explain the implication, recommend \
the action, and close with the open question.
- Tone: confident, curious, a little provocative -- like a smart colleague who just \
found something you need to see, not a dry report.
- Output clean semantic HTML only: <h1>, <h2>, <p>, <ul>/<li>. No inline styles, no \
markdown, no code fences, no commentary outside the HTML.
- Target 1000-2000 words for a typical dataset; shorter is fine if the arc is thin.
"""

TEXT_SYSTEM_PROMPT = """You are DataBrief's story writer. You read raw documents and \
surface what's surprising or noteworthy in them, written as a curiosity-driven story.

Rules:
- Only narrate facts present in the document text given to you. Never invent details.
- Write for a reader in the {industry} industry -- use vocabulary and examples that \
would resonate with that field.
- Open with a hook naming the most interesting thing in the document, give context, \
walk through 3-5 specific findings drawn from the text, then close with an implication \
and a question worth investigating further.
- Tone: confident, curious, a little provocative -- like a smart colleague who just \
read this and needs to tell you about it.
- Output clean semantic HTML only: <h1>, <h2>, <p>, <ul>/<li>. No inline styles, no \
markdown, no code fences, no commentary outside the HTML.
"""


COLUMN_RESOLVER_PROMPT = """You are a data analyst. A user has uploaded a dataset and asked a question. \
Your job is to identify which columns are relevant to answering their question.

Return ONLY a valid JSON object -- no explanation, no markdown, no code fences.

JSON format:
{
  "relevant_cols": ["col1", "col2"],
  "independent_var": "col_name_or_null",
  "dependent_var": "col_name_or_null",
  "question_type": "ranking|dose_response|comparison|trend|general"
}

question_type guide:
- "ranking": who/what has the most/best/highest
- "dose_response": does more X lead to better/worse Y?
- "comparison": how do groups compare?
- "trend": how did X change over time?
- "general": anything else

Rules:
- Only return column names that actually exist in the dataset
- relevant_cols should include all columns needed to answer the question (2-6 max)
- independent_var is the input/cause being tested -- null if not applicable
- dependent_var is the outcome being measured -- null if not applicable
"""


def identify_relevant_columns(
    question: str,
    columns: list[str],
    sample_values: dict[str, list],
) -> dict:
    """One small LLM call to identify which columns answer the question.
    Returns dict with relevant_cols, independent_var, dependent_var, question_type.
    Falls back to empty result on any failure."""
    fallback = {
        "relevant_cols": [],
        "independent_var": None,
        "dependent_var": None,
        "question_type": "general",
    }
    if not settings.groq_api_key:
        return fallback

    col_context = {col: [str(v) for v in vals[:3]] for col, vals in sample_values.items()}
    user_msg = (
        f'Question: "{question}"\n\n'
        f"Dataset columns with sample values:\n"
        f"{_json.dumps(col_context, indent=2)}"
    )

    try:
        from groq import Groq
        client = Groq(api_key=settings.groq_api_key, timeout=15.0)
        response = client.chat.completions.create(
            model=MODEL,
            max_tokens=300,
            temperature=0,
            messages=[
                {"role": "system", "content": COLUMN_RESOLVER_PROMPT},
                {"role": "user", "content": user_msg},
            ],
        )
        raw = (response.choices[0].message.content or "").strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = _json.loads(raw)
        result["relevant_cols"] = [c for c in result.get("relevant_cols", []) if c in columns]
        if result.get("independent_var") not in columns:
            result["independent_var"] = None
        if result.get("dependent_var") not in columns:
            result["dependent_var"] = None
        return result
    except Exception:
        logger.exception("Column identification LLM call failed, falling back to keyword matching")
        return fallback


def _build_user_message(story_arc: dict[str, Any], question: str | None) -> str:
    question_line = f'\nThe user specifically asked: "{question}"' if question else ""
    return f"Here is the pre-computed story arc to narrate:\n\n{story_arc}{question_line}"


def _word_count(html_text: str) -> int:
    import re

    text_only = re.sub(r"<[^>]+>", " ", html_text)
    return len([w for w in text_only.split() if w.strip()])


def generate_story_html(
    story_arc: dict[str, Any], industry: str | None = None, question: str | None = None
) -> tuple[str, int]:
    """Returns (story_html, word_count). Falls back to a deterministic template
    if no GROQ_API_KEY is configured or the API call fails, so the pipeline
    never hard-fails on an external dependency."""
    if settings.groq_api_key:
        try:
            return _generate_with_groq(story_arc, industry, question)
        except Exception:
            logger.exception("Groq story generation failed, falling back to template")

    return _fallback_story_html(story_arc)


def _generate_with_groq(
    story_arc: dict[str, Any], industry: str | None, question: str | None
) -> tuple[str, int]:
    import copy

    from groq import Groq

    # chart_b64 strings are large binary blobs — strip them before sending to the LLM
    arc = copy.deepcopy(story_arc)
    for f in arc.get("findings", []):
        f.get("extra", {}).pop("chart_b64", None)

    client = Groq(api_key=settings.groq_api_key, timeout=30.0)
    is_text_doc = "raw_text" in arc
    system = TEXT_SYSTEM_PROMPT if is_text_doc else SYSTEM_PROMPT
    response = client.chat.completions.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        messages=[
            {"role": "system", "content": system.format(industry=industry or "general business")},
            {"role": "user", "content": _build_user_message(arc, question)},
        ],
    )
    story_html = (response.choices[0].message.content or "").strip()
    return story_html, _word_count(story_html)


def _chart_img_tag(finding: dict) -> str:
    b64 = finding.get("extra", {}).get("chart_b64")
    if not b64:
        return ""
    return (
        '<div style="margin: 16px 0;">'
        f'<img src="data:image/png;base64,{b64}" '
        'style="max-width: 100%; height: auto; border-radius: 4px;" />'
        '</div>'
    )


def _fallback_story_html(story_arc: dict[str, Any]) -> tuple[str, int]:
    if "raw_text" in story_arc:
        return _fallback_text_story_html(story_arc)

    hook = html.escape(story_arc.get("hook") or "Your data has a story to tell.")
    context = html.escape(story_arc.get("context") or "")
    findings = story_arc.get("findings") or []
    implication = html.escape(story_arc.get("implication") or "")
    action = html.escape(story_arc.get("action") or "")
    open_question = story_arc.get("open_question")
    question = story_arc.get("question")

    parts = [f"<h1>{hook}</h1>"]

    if question:
        parts.append(f'<p><em>Answering: "{html.escape(question)}"</em></p>')

    parts.append(f"<p>{context}</p>")

    combined_rankings = [f for f in findings if f.get("type") == "ranking" and f.get("extra", {}).get("is_combined")]
    individual_rankings = [f for f in findings if f.get("type") == "ranking" and not f.get("extra", {}).get("is_combined")]
    other_findings = [f for f in findings if f.get("type") != "ranking"]

    if combined_rankings:
        top = combined_rankings[0]
        extra = top.get("extra", {})
        top_entity = extra.get("top_entity", "")
        top_value = extra.get("top_value", 0)
        combined_cols = extra.get("combined_cols", [])
        leaderboard = extra.get("leaderboard", {})
        cols_readable = " and ".join(
            c.replace("_", " ").replace("tournament", "").strip() for c in combined_cols
        )
        parts.append("<h2>The Headline</h2>")
        parts.append(
            f"<p><strong>{html.escape(str(top_entity))}</strong> comes out on top when measuring "
            f"{html.escape(cols_readable)} combined, accumulating "
            f"<strong>{int(top_value):,}</strong> total contributions.</p>"
        )
        if leaderboard:
            parts.append("<h2>The Full Leaderboard</h2><ol>")
            for name, val in list(leaderboard.items())[:5]:
                parts.append(f"<li><strong>{html.escape(str(name))}</strong> -- {int(val):,} contributions</li>")
            parts.append("</ol>")
        parts.append(_chart_img_tag(top))

    if individual_rankings:
        parts.append("<h2>Breaking It Down</h2>")
        for f in individual_rankings[:3]:
            extra = f.get("extra", {})
            top_entity = extra.get("top_entity", "")
            col = extra.get("col", "").replace("_", " ").replace("tournament", "").strip()
            leaderboard = extra.get("leaderboard", {})
            if leaderboard:
                items = list(leaderboard.items())
                rest = ", ".join(f"{html.escape(str(n))} ({int(v):,})" for n, v in items[1:3])
                parts.append(
                    f"<p><strong>{html.escape(str(top_entity))}</strong> leads in {html.escape(col)}"
                    + (f", followed by {rest}." if rest else ".")
                    + "</p>"
                )
                parts.append(_chart_img_tag(f))

    if not combined_rankings and not individual_rankings and other_findings:
        parts.append("<h2>What the data shows</h2>")
        for f in other_findings[:5]:
            parts.append(f"<p>{html.escape(f.get('description', ''))}</p>")
            parts.append(_chart_img_tag(f))
    elif other_findings:
        parts.append("<h2>What else the data shows</h2>")
        for f in other_findings[:3]:
            parts.append(f"<p>{html.escape(f.get('description', ''))}</p>")
            parts.append(_chart_img_tag(f))

    if implication:
        parts.append(f"<h2>What this means</h2><p>{implication}</p>")
    if action:
        parts.append(f"<h2>What to do next</h2><p>{action}</p>")
    if open_question:
        parts.append(f"<h2>Worth investigating</h2><p>{html.escape(open_question)}</p>")

    story_html = "\n".join(parts)
    return story_html, _word_count(story_html)


def _fallback_text_story_html(story_arc: dict[str, Any]) -> tuple[str, int]:
    hook = html.escape(story_arc.get("hook") or "Here's what's in this document.")
    context = html.escape(story_arc.get("context") or "")
    question = story_arc.get("question")
    snippet = html.escape((story_arc.get("raw_text") or "")[:1500])

    parts = [f"<h1>{hook}</h1>", f"<p>{context}</p>"]
    if question:
        parts.append(f'<p><em>In answer to: "{html.escape(question)}"</em></p>')
    parts.append(f"<h2>Excerpt</h2><p>{snippet}</p>")

    story_html = "\n".join(parts)
    return story_html, _word_count(story_html)
