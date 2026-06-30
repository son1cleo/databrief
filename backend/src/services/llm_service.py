import html
import logging
from typing import Any

from src.core.config import settings

logger = logging.getLogger(__name__)

MODEL = "claude-3-5-haiku-20241022"
MAX_TOKENS = 4096

SYSTEM_PROMPT = """You are DataBrief's story writer. You turn pre-computed statistical \
findings into a curiosity-driven narrative that makes the reader lean forward.

Rules:
- Only narrate the facts given to you in the story arc JSON. Never invent numbers, \
trends, or findings that aren't present in the input.
- Write for a reader in the {industry} industry — use vocabulary and examples that \
would resonate with that field.
- Follow the story arc structure exactly: open with the hook, establish context, walk \
through the findings in order, build to the climax, explain the implication, recommend \
the action, and close with the open question.
- Tone: confident, curious, a little provocative — like a smart colleague who just \
found something you need to see, not a dry report.
- Output clean semantic HTML only: <h1>, <h2>, <p>, <ul>/<li>. No inline styles, no \
markdown, no code fences, no commentary outside the HTML.
- Target 1000-2000 words for a typical dataset; shorter is fine if the arc is thin.
"""

TEXT_SYSTEM_PROMPT = """You are DataBrief's story writer. You read raw documents and \
surface what's surprising or noteworthy in them, written as a curiosity-driven story.

Rules:
- Only narrate facts present in the document text given to you. Never invent details.
- Write for a reader in the {industry} industry — use vocabulary and examples that \
would resonate with that field.
- Open with a hook naming the most interesting thing in the document, give context, \
walk through 3-5 specific findings drawn from the text, then close with an implication \
and a question worth investigating further.
- Tone: confident, curious, a little provocative — like a smart colleague who just \
read this and needs to tell you about it.
- Output clean semantic HTML only: <h1>, <h2>, <p>, <ul>/<li>. No inline styles, no \
markdown, no code fences, no commentary outside the HTML.
"""


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
    if no ANTHROPIC_API_KEY is configured or the API call fails, so the pipeline
    never hard-fails on an external dependency."""
    if settings.anthropic_api_key:
        try:
            return _generate_with_claude(story_arc, industry, question)
        except Exception:
            logger.exception("Claude story generation failed, falling back to template")

    return _fallback_story_html(story_arc)


def _generate_with_claude(
    story_arc: dict[str, Any], industry: str | None, question: str | None
) -> tuple[str, int]:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    is_text_doc = "raw_text" in story_arc
    system = TEXT_SYSTEM_PROMPT if is_text_doc else SYSTEM_PROMPT
    response = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=system.format(industry=industry or "general business"),
        messages=[{"role": "user", "content": _build_user_message(story_arc, question)}],
    )
    story_html = "".join(block.text for block in response.content if block.type == "text").strip()
    return story_html, _word_count(story_html)


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

    parts = [f"<h1>{hook}</h1>", f"<p>{context}</p>"]

    if question:
        parts.append(f"<p><em>In answer to: “{html.escape(question)}”</em></p>")

    if findings:
        parts.append("<h2>What the data shows</h2><ul>")
        for finding in findings:
            desc = html.escape(finding.get("description", ""))
            parts.append(f"<li>{desc}</li>")
        parts.append("</ul>")

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
        parts.append(f"<p><em>In answer to: “{html.escape(question)}”</em></p>")
    parts.append(f"<h2>Excerpt</h2><p>{snippet}</p>")

    story_html = "\n".join(parts)
    return story_html, _word_count(story_html)
