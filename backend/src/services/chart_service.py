"""Generate matplotlib charts from findings and DataFrames.
Returns base64-encoded PNG strings for embedding in HTML/PDF/Word/PPTX."""

import base64
import io
import logging
from typing import Any

import matplotlib
matplotlib.use("Agg")  # non-interactive backend — must be before pyplot import
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

ACCENT = "#2563eb"
ACCENT_LIGHT = "#93c5fd"
DANGER = "#ef4444"
TEXT = "#1a1a1a"
GRID = "#e5e7eb"
BG = "#ffffff"

plt.rcParams.update({
    "figure.facecolor": BG,
    "axes.facecolor": BG,
    "axes.edgecolor": GRID,
    "axes.labelcolor": TEXT,
    "xtick.color": TEXT,
    "ytick.color": TEXT,
    "text.color": TEXT,
    "grid.color": GRID,
    "font.family": "DejaVu Sans",
    "font.size": 11,
})


def _to_base64(fig: plt.Figure) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight", facecolor=BG)
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode("utf-8")
    plt.close(fig)
    return b64


def horizontal_bar(
    labels: list[str],
    values: list[float],
    title: str,
    xlabel: str = "",
    max_items: int = 10,
) -> str:
    """Horizontal bar chart for ranking/leaderboard findings."""
    labels = labels[:max_items]
    values = values[:max_items]
    labels_r = list(reversed(labels))
    values_r = list(reversed(values))

    fig, ax = plt.subplots(figsize=(8, max(3, len(labels_r) * 0.5)))
    colors = [ACCENT if i == len(labels_r) - 1 else ACCENT_LIGHT for i in range(len(labels_r))]
    bars = ax.barh(labels_r, values_r, color=colors, height=0.6)

    max_val = max(values_r) if values_r else 1
    for bar, val in zip(bars, values_r):
        ax.text(
            bar.get_width() + max_val * 0.01,
            bar.get_y() + bar.get_height() / 2,
            f"{val:,.0f}",
            va="center", ha="left", fontsize=10, color=TEXT,
        )

    ax.set_title(title, fontsize=13, fontweight="bold", color=TEXT, pad=12)
    if xlabel:
        ax.set_xlabel(xlabel, fontsize=10)
    ax.set_xlim(0, max_val * 1.18)
    ax.xaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"{x:,.0f}"))
    ax.grid(axis="x", linestyle="--", alpha=0.5)
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    return _to_base64(fig)


def line_chart(
    x: list,
    y: list[float],
    title: str,
    xlabel: str = "",
    ylabel: str = "",
    add_trendline: bool = True,
) -> str:
    """Line chart for trend findings."""
    fig, ax = plt.subplots(figsize=(9, 4))
    ax.plot(x, y, color=ACCENT, linewidth=2.5, marker="o", markersize=4, label=ylabel or "Value")

    if add_trendline and len(x) >= 3:
        x_num = np.arange(len(x), dtype=float)
        slope, intercept = np.polyfit(x_num, y, 1)
        trend = slope * x_num + intercept
        ax.plot(x, trend, color=DANGER, linewidth=1.5, linestyle="--", label="Trend", alpha=0.7)
        ax.legend(fontsize=9)

    ax.set_title(title, fontsize=13, fontweight="bold", color=TEXT, pad=12)
    if xlabel:
        ax.set_xlabel(xlabel, fontsize=10)
    if ylabel:
        ax.set_ylabel(ylabel, fontsize=10)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"{x:,.1f}"))
    ax.grid(linestyle="--", alpha=0.4)
    ax.spines[["top", "right"]].set_visible(False)
    if len(x) > 8:
        plt.setp(ax.get_xticklabels(), rotation=45, ha="right", fontsize=8)
    fig.tight_layout()
    return _to_base64(fig)


def scatter_chart(
    x: list[float],
    y: list[float],
    title: str,
    xlabel: str = "",
    ylabel: str = "",
) -> str:
    """Scatter plot for correlation findings."""
    fig, ax = plt.subplots(figsize=(7, 5))
    ax.scatter(x, y, color=ACCENT, alpha=0.5, s=20, edgecolors="none")

    if len(x) >= 3:
        m, b = np.polyfit(x, y, 1)
        x_line = np.linspace(min(x), max(x), 100)
        ax.plot(x_line, m * x_line + b, color=DANGER, linewidth=2, linestyle="--", alpha=0.8)

    ax.set_title(title, fontsize=13, fontweight="bold", color=TEXT, pad=12)
    ax.set_xlabel(xlabel or "x", fontsize=10)
    ax.set_ylabel(ylabel or "y", fontsize=10)
    ax.grid(linestyle="--", alpha=0.4)
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    return _to_base64(fig)


def histogram_chart(values: list[float], title: str, xlabel: str = "") -> str:
    """Histogram with mean/std lines for distribution findings."""
    arr = np.array(values, dtype=float)
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.hist(arr, bins=30, color=ACCENT_LIGHT, edgecolor=ACCENT, linewidth=0.5)

    mean, std = float(arr.mean()), float(arr.std())
    ax.axvline(mean, color=ACCENT, linewidth=2, label=f"Mean: {mean:,.2f}")
    ax.axvline(mean + std, color=DANGER, linewidth=1.5, linestyle="--", alpha=0.7,
               label=f"+1 SD: {mean + std:,.2f}")
    ax.axvline(mean - std, color=DANGER, linewidth=1.5, linestyle="--", alpha=0.7,
               label=f"-1 SD: {mean - std:,.2f}")

    ax.set_title(title, fontsize=13, fontweight="bold", color=TEXT, pad=12)
    if xlabel:
        ax.set_xlabel(xlabel, fontsize=10)
    ax.set_ylabel("Count", fontsize=10)
    ax.legend(fontsize=9)
    ax.grid(axis="y", linestyle="--", alpha=0.4)
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    return _to_base64(fig)


def box_chart(
    values: list[float],
    title: str,
    ylabel: str = "",
    outlier_val: float | None = None,
) -> str:
    """Box plot highlighting outliers for outlier findings."""
    arr = np.array(values, dtype=float)
    fig, ax = plt.subplots(figsize=(5, 5))
    ax.boxplot(
        arr,
        patch_artist=True,
        widths=0.4,
        boxprops=dict(facecolor=ACCENT_LIGHT, color=ACCENT),
        medianprops=dict(color=ACCENT, linewidth=2),
        whiskerprops=dict(color=ACCENT),
        capprops=dict(color=ACCENT),
        flierprops=dict(marker="o", color=DANGER, alpha=0.6, markersize=4),
    )

    if outlier_val is not None:
        ax.axhline(
            outlier_val, color=DANGER, linewidth=1.5, linestyle="--", alpha=0.8,
            label=f"Most extreme: {outlier_val:,.2f}",
        )
        ax.legend(fontsize=9)

    ax.set_title(title, fontsize=13, fontweight="bold", color=TEXT, pad=12)
    if ylabel:
        ax.set_ylabel(ylabel, fontsize=10)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"{x:,.1f}"))
    ax.grid(axis="y", linestyle="--", alpha=0.4)
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    return _to_base64(fig)


def chart_for_finding(finding_dict: dict[str, Any], df: pd.DataFrame) -> str | None:
    """Return a base64 PNG for a finding, or None if no chart applies."""
    ftype = finding_dict.get("type")
    cols = finding_dict.get("columns", [])
    extra = finding_dict.get("extra", {})

    try:
        if ftype == "ranking":
            leaderboard = extra.get("leaderboard", {})
            if not leaderboard:
                return None
            labels = list(leaderboard.keys())[:10]
            values = [float(leaderboard[k]) for k in labels]
            combined_cols = extra.get("combined_cols")
            if combined_cols:
                col_label = " + ".join(c.replace("_", " ") for c in combined_cols)
            else:
                col_label = cols[-1].replace("_", " ") if cols else "Value"
            return horizontal_bar(labels, values, title=f"Top {len(labels)} by {col_label}", xlabel=col_label)

        if ftype == "trend" and len(cols) >= 2:
            metric_col, date_col = cols[0], cols[1]
            if metric_col not in df.columns or date_col not in df.columns:
                return None
            sub = df[[date_col, metric_col]].dropna()
            sub = sub.copy()
            sub[date_col] = pd.to_datetime(sub[date_col], errors="coerce", format="mixed")
            sub = sub.dropna().sort_values(date_col)
            if len(sub) < 3:
                return None
            if len(sub) > 100:
                sub = sub.iloc[:: len(sub) // 100]
            x = sub[date_col].dt.strftime("%Y-%m-%d").tolist()
            y = sub[metric_col].tolist()
            return line_chart(x, y, title=f"{metric_col} over time",
                              xlabel=date_col, ylabel=metric_col.replace("_", " "))

        if ftype == "correlation" and len(cols) >= 2:
            col_a, col_b = cols[0], cols[1]
            if col_a not in df.columns or col_b not in df.columns:
                return None
            sub = df[[col_a, col_b]].dropna()
            if len(sub) < 10:
                return None
            if len(sub) > 2000:
                sub = sub.sample(2000, random_state=42)
            r = extra.get("r", 0)
            return scatter_chart(
                sub[col_a].tolist(), sub[col_b].tolist(),
                title=f"{col_a} vs {col_b} (r={r:.2f})",
                xlabel=col_a.replace("_", " "),
                ylabel=col_b.replace("_", " "),
            )

        if ftype == "distribution" and cols:
            col = cols[0]
            if col not in df.columns:
                return None
            values = df[col].dropna().tolist()
            if len(values) < 8:
                return None
            skew = extra.get("skew", 0)
            return histogram_chart(
                values,
                title=f"Distribution of {col} (skew={skew:.2f})",
                xlabel=col.replace("_", " "),
            )

        if ftype == "dose_response":
            bins = extra.get("bins", {})
            if not bins:
                return None
            x_col = extra.get("independent_var") or (cols[0] if cols else "X")
            outcome_label = extra.get("outcome_label") or (cols[1].replace("_", " ") if len(cols) > 1 else "Outcome")
            labels = list(bins.keys())
            values = [bins[k] for k in labels]
            peak_val = max(values)
            colors = [ACCENT if v == peak_val else ACCENT_LIGHT for v in values]

            fig, ax = plt.subplots(figsize=(8, 4.5))
            bars = ax.bar(labels, values, color=colors, width=0.55)

            abs_max = max(abs(v) for v in values) or 1
            for bar, val in zip(bars, values):
                y_offset = abs_max * 0.04 if val >= 0 else -abs_max * 0.12
                ax.text(
                    bar.get_x() + bar.get_width() / 2,
                    val + y_offset,
                    f"{val:+.3f}",
                    ha="center", va="bottom", fontsize=11,
                    color=ACCENT if val == peak_val else TEXT,
                    fontweight="bold" if val == peak_val else "normal",
                )

            x_readable = x_col.replace("_", " ")
            ax.set_title(
                f"{outcome_label} by {x_readable} usage (quartiles)",
                fontsize=13, fontweight="bold", color=TEXT, pad=12,
            )
            ax.set_xlabel(f"{x_readable} quartile", fontsize=10)
            ax.set_ylabel(outcome_label, fontsize=10)
            ax.axhline(0, color=GRID, linewidth=1)
            ax.grid(axis="y", linestyle="--", alpha=0.4)
            ax.spines[["top", "right"]].set_visible(False)
            fig.tight_layout()
            return _to_base64(fig)

        if ftype == "outlier" and cols:
            col = cols[0]
            if col not in df.columns:
                return None
            values = df[col].dropna().tolist()
            outlier_val = finding_dict.get("value")
            return box_chart(
                values,
                title=f"Outliers in {col}",
                ylabel=col.replace("_", " "),
                outlier_val=float(outlier_val) if outlier_val is not None else None,
            )

    except Exception:
        logger.exception("chart_for_finding failed for type=%s", ftype)
        return None

    return None
