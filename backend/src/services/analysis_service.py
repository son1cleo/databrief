from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd

CORRELATION_THRESHOLD = 0.5
SKEW_THRESHOLD = 1.0
IQR_MULTIPLIER = 1.5


@dataclass
class Finding:
    type: str  # descriptive | trend | outlier | correlation | distribution | data_quality | ranking
    columns: list[str]
    description: str
    value: float | None = None
    magnitude: float = 0.0  # 0-1, how large/impactful the effect is
    confidence: float = 0.5  # 0-1, how statistically trustworthy the finding is
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "columns": self.columns,
            "description": self.description,
            "value": self.value,
            "magnitude": round(self.magnitude, 3),
            "confidence": round(self.confidence, 3),
            "extra": self.extra,
        }


def _numeric_columns(df: pd.DataFrame) -> list[str]:
    return df.select_dtypes(include=[np.number]).columns.tolist()


def _datetime_columns(df: pd.DataFrame) -> list[str]:
    cols = []
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            cols.append(col)
            continue
        if df[col].dtype == object:
            sample = df[col].dropna().head(20)
            if len(sample) == 0:
                continue
            try:
                parsed = pd.to_datetime(sample, errors="coerce", format="mixed")
                if parsed.notna().mean() > 0.8:
                    cols.append(col)
            except (ValueError, TypeError):
                continue
    return cols


def _label_column(df: pd.DataFrame, numeric_cols: list[str]) -> str | None:
    candidates = [c for c in df.columns if c not in numeric_cols and df[c].dtype == object]
    name_cols = [c for c in candidates if "name" in c.lower()]
    if name_cols:
        return name_cols[0]
    non_id = [c for c in candidates if not any(x in c.lower() for x in ["_id", "_code", "_key"])]
    return non_id[0] if non_id else (candidates[0] if candidates else None)


def _descriptive_findings(df: pd.DataFrame, numeric_cols: list[str]) -> list[Finding]:
    findings = []
    for col in [c for c in numeric_cols if not c.startswith("change_")]:
        series = df[col].dropna()
        if series.empty:
            continue
        mean, std = series.mean(), series.std()
        cv = abs(std / mean) if mean else 0  # coefficient of variation
        findings.append(
            Finding(
                type="descriptive",
                columns=[col],
                description=(
                    f"{col} ranges from {series.min():,.2f} to {series.max():,.2f}, "
                    f"averaging {mean:,.2f}."
                ),
                value=float(mean),
                magnitude=min(cv / 2, 1.0),
                confidence=min(len(series) / 50, 1.0),
                extra={"mean": float(mean), "std": float(std), "min": float(series.min()), "max": float(series.max())},
            )
        )
    return findings


def _trend_findings(df: pd.DataFrame, numeric_cols: list[str], date_cols: list[str]) -> list[Finding]:
    if not date_cols or not numeric_cols:
        return []
    findings = []
    date_col = date_cols[0]
    dates = pd.to_datetime(df[date_col], errors="coerce", format="mixed")
    for col in numeric_cols:
        sub = pd.DataFrame({"date": dates, "value": df[col]}).dropna().sort_values("date")
        if len(sub) < 3:
            continue
        x = (sub["date"] - sub["date"].min()).dt.days.to_numpy(dtype=float)
        y = sub["value"].to_numpy(dtype=float)
        if x.max() == 0:
            continue
        slope, intercept = np.polyfit(x, y, 1)
        predicted = slope * x + intercept
        ss_res = np.sum((y - predicted) ** 2)
        ss_tot = np.sum((y - y.mean()) ** 2)
        r_squared = 1 - ss_res / ss_tot if ss_tot else 0
        start_val, end_val = predicted[0], predicted[-1]
        pct_change = ((end_val - start_val) / abs(start_val)) * 100 if start_val else 0
        direction = "increased" if pct_change >= 0 else "decreased"
        findings.append(
            Finding(
                type="trend",
                columns=[col, date_col],
                description=(
                    f"{col} {direction} by {abs(pct_change):,.1f}% over the observed period "
                    f"(by {date_col})."
                ),
                value=float(pct_change),
                magnitude=min(abs(pct_change) / 100, 1.0),
                confidence=min(max(r_squared, 0), 1.0),
                extra={"slope": float(slope), "r_squared": float(r_squared)},
            )
        )
    return findings


def _outlier_findings(df: pd.DataFrame, numeric_cols: list[str], label_col: str | None) -> list[Finding]:
    findings = []
    for col in [c for c in numeric_cols if not c.startswith("change_")]:
        series = df[col].dropna()
        if len(series) < 5:
            continue
        q1, q3 = series.quantile(0.25), series.quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            continue
        lower, upper = q1 - IQR_MULTIPLIER * iqr, q3 + IQR_MULTIPLIER * iqr
        outliers = series[(series < lower) | (series > upper)]
        if outliers.empty:
            continue
        most_extreme_idx = (outliers - series.median()).abs().idxmax()
        most_extreme_val = df.loc[most_extreme_idx, col]
        label = f" ({df.loc[most_extreme_idx, label_col]})" if label_col else ""
        pct_of_data = len(outliers) / len(series)
        findings.append(
            Finding(
                type="outlier",
                columns=[col],
                description=(
                    f"{col} has {len(outliers)} outlier{'s' if len(outliers) != 1 else ''} "
                    f"({pct_of_data:.1%} of values); the most extreme is {most_extreme_val:,.2f}{label}."
                ),
                value=float(most_extreme_val),
                magnitude=min(abs(most_extreme_val - series.median()) / (iqr or 1) / 4, 1.0),
                confidence=min(1.0 - pct_of_data, 1.0),
                extra={"outlier_count": int(len(outliers)), "pct_of_data": float(pct_of_data)},
            )
        )
    return findings


def _correlation_findings(df: pd.DataFrame, numeric_cols: list[str]) -> list[Finding]:
    if len(numeric_cols) < 2:
        return []
    corr = df[numeric_cols].corr(numeric_only=True)
    findings = []
    seen = set()
    n = len(df)
    for col_a in numeric_cols:
        for col_b in numeric_cols:
            if col_a == col_b or (col_b, col_a) in seen:
                continue
            # Skip pairs where BOTH are derived change columns — meaningless to readers
            if col_a.startswith("change_") and col_b.startswith("change_"):
                continue
            seen.add((col_a, col_b))
            r = corr.loc[col_a, col_b]
            if pd.isna(r) or abs(r) < CORRELATION_THRESHOLD:
                continue
            direction = "positively" if r > 0 else "negatively"
            findings.append(
                Finding(
                    type="correlation",
                    columns=[col_a, col_b],
                    description=f"{col_a} and {col_b} are {direction} correlated (r={r:.2f}).",
                    value=float(r),
                    magnitude=min(abs(r), 1.0),
                    confidence=min(n / 30, 1.0),
                    extra={"r": float(r), "n": int(n)},
                )
            )
    return findings


def _distribution_findings(df: pd.DataFrame, numeric_cols: list[str]) -> list[Finding]:
    findings = []
    for col in [c for c in numeric_cols if not c.startswith("change_")]:
        series = df[col].dropna()
        if len(series) < 8:
            continue
        skew = series.skew()
        if pd.isna(skew) or abs(skew) < SKEW_THRESHOLD:
            continue
        direction = "right" if skew > 0 else "left"
        findings.append(
            Finding(
                type="distribution",
                columns=[col],
                description=(
                    f"{col} is heavily {direction}-skewed (skew={skew:.2f}), "
                    f"meaning a small number of {'large' if skew > 0 else 'small'} values dominate."
                ),
                value=float(skew),
                magnitude=min(abs(skew) / 3, 1.0),
                confidence=min(len(series) / 50, 1.0),
                extra={"skew": float(skew)},
            )
        )
    return findings


def _data_quality_finding(df: pd.DataFrame) -> Finding:
    total_cells = df.shape[0] * df.shape[1]
    missing = int(df.isna().sum().sum())
    missing_pct = missing / total_cells if total_cells else 0
    quality_score = max(0.0, 1 - missing_pct)
    return Finding(
        type="data_quality",
        columns=df.columns.tolist(),
        description=f"Dataset is {quality_score:.0%} complete ({missing} missing values across {total_cells} cells).",
        value=float(quality_score),
        magnitude=missing_pct,
        confidence=1.0,
        extra={"missing_cells": missing, "total_cells": total_cells},
    )


def _question_relevant_columns(df: pd.DataFrame, question: str | None, numeric_cols: list[str]) -> list[str]:
    """Fallback keyword matcher used when LLM column identification is unavailable."""
    if not question:
        return []
    question_lower = question.lower()
    stop = {"the", "a", "an", "is", "in", "of", "and", "or", "who", "what",
            "how", "most", "has", "have", "are", "for", "to", "by", "with",
            "does", "using", "more", "actually", "there", "point", "students",
            "combined", "both", "terms", "impact"}
    keywords = [w.rstrip("?.,!") for w in question_lower.split() if w.rstrip("?.,!") not in stop]

    matched = []
    for col in df.columns:
        col_lower = col.lower().replace("_", " ")
        for kw in keywords:
            if len(kw) >= 3 and (kw in col_lower or col_lower.startswith(kw)):
                matched.append(col)
                break

    team_noise = ["_team", "_opponent"]
    matched = [c for c in matched if not any(n in c.lower() for n in team_noise)]

    preferred = []
    already_covered: set[str] = set()
    for kw in keywords:
        tournament_cols = [c for c in matched if kw in c.lower() and "tournament" in c.lower()]
        other_cols = [c for c in matched if kw in c.lower() and "tournament" not in c.lower()]
        if tournament_cols:
            preferred.extend(tournament_cols)
            already_covered.update(other_cols)
        else:
            preferred.extend([c for c in other_cols if c not in already_covered])

    seen: set[str] = set()
    result = []
    for c in preferred:
        if c not in seen:
            seen.add(c)
            result.append(c)
    return result


def _is_ranking_question(question: str | None) -> bool:
    if not question:
        return False
    triggers = {"who", "which", "most", "highest", "top", "best", "greatest", "leading", "leader"}
    return any(t in question.lower() for t in triggers)


def _is_dose_response_question(question: str | None) -> bool:
    if not question:
        return False
    triggers = {"does", "affect", "help", "hurt", "impact", "more", "less",
                "better", "worse", "improve", "point where", "too much", "optimal"}
    q = question.lower()
    return any(t in q for t in triggers)


def _is_comparison_question(question: str | None) -> bool:
    if not question:
        return False
    triggers = {"compare", "versus", "vs", "differ", "difference", "between", "among",
                "which group", "which region", "which department", "which category"}
    q = question.lower()
    return any(t in q for t in triggers)


def _find_pre_column(df: pd.DataFrame, post_col: str) -> str | None:
    """Given a Post_* / *_after column, find the matching Pre_* / *_before column."""
    post_lower = post_col.lower()
    for post_prefix, pre_prefix in [
        ("post_", "pre_"), ("after_", "before_"), ("_post", "_pre"), ("_after", "_before")
    ]:
        if post_prefix in post_lower:
            candidate = post_lower.replace(post_prefix, pre_prefix)
            for col in df.columns:
                if col.lower() == candidate:
                    return col
    # Fuzzy: find col with "pre" where post_col has "post", same remaining stem
    post_stripped = post_lower.replace("post", "").replace("_", "")
    for col in df.columns:
        col_lower = col.lower()
        if "pre" in col_lower:
            col_stripped = col_lower.replace("pre", "").replace("_", "")
            if post_stripped and col_stripped == post_stripped:
                return col
    return None


def _dose_response_findings(
    df: pd.DataFrame,
    question: str | None,
    relevant_cols: list[str],
    numeric_cols: list[str],
    independent_var: str | None = None,
    dependent_var: str | None = None,
) -> list[Finding]:
    """For dose-response questions (does more X lead to better/worse Y?), compute
    correlation + quartile analysis to detect linear vs non-linear effects.
    When dependent_var is a Post_* column, uses Post - Pre as the outcome so
    pre-existing differences don't swamp the signal."""
    if not relevant_cols and not (independent_var and dependent_var):
        return []

    if independent_var and dependent_var:
        pairs_to_test = [(independent_var, dependent_var)]
    else:
        pairs_to_test = [
            (x, y) for x in relevant_cols for y in relevant_cols
            if x != y and x in numeric_cols and y in numeric_cols
        ]

    findings = []
    for x_col, y_col in pairs_to_test[:5]:
        if x_col not in df.columns or y_col not in df.columns:
            continue

        # Resolve outcome: use Post - Pre when possible to isolate the treatment effect
        pre_col = _find_pre_column(df, y_col)
        if pre_col and pre_col in df.columns:
            cols_needed = [x_col, y_col, pre_col]
            sub = df[cols_needed].dropna()
            outcome = sub[y_col] - sub[pre_col]
            outcome_label = f"{y_col.replace('_', ' ')} change (vs pre)"
        else:
            sub = df[[x_col, y_col]].dropna()
            outcome = sub[y_col]
            outcome_label = y_col.replace("_", " ")

        if len(sub) < 20:
            continue
        x_arr = sub[x_col].to_numpy(dtype=float)
        y_arr = outcome.to_numpy(dtype=float)
        if x_arr.std() == 0 or y_arr.std() == 0:
            continue
        r = float(np.corrcoef(x_arr, y_arr)[0, 1])

        bins: dict[str, float] = {}
        peak_bucket: str | None = None
        try:
            all_labels = ["Low", "Medium", "High", "Very High"]
            sub2 = sub[[x_col]].copy()
            sub2["_outcome"] = y_arr
            for n_q in [4, 3, 2]:
                try:
                    labels = all_labels[:n_q]
                    sub2["_xbin"] = pd.qcut(sub2[x_col], q=n_q, labels=labels, duplicates="drop")
                    bin_medians = sub2.groupby("_xbin", observed=True)["_outcome"].median()
                    bins = {str(k): round(float(v), 4) for k, v in bin_medians.items()}
                    break
                except Exception:
                    continue
        except Exception:
            pass

        vals = list(bins.values())
        keys = list(bins.keys())
        if len(vals) >= 3:
            peak_idx = vals.index(max(vals))
            if 0 < peak_idx < len(vals) - 1:
                pattern = "inverted_u"
                peak_bucket = keys[peak_idx]
            elif vals[-1] > vals[0]:
                pattern = "linear_positive"
            else:
                pattern = "linear_negative"
        elif len(vals) >= 2:
            pattern = "linear_positive" if vals[-1] > vals[0] else "linear_negative"
        else:
            pattern = "general"

        pattern_descs = {
            "inverted_u": f"there is a sweet spot -- outcome peaks at {peak_bucket} usage then declines",
            "linear_positive": "more X consistently associates with better outcome",
            "linear_negative": "more X consistently associates with worse outcome",
            "general": "no clear directional pattern detected",
        }
        bucket_str = ", ".join(f"{k}: {v:+.3f}" for k, v in bins.items())
        description = (
            f"When examining how {x_col.replace('_', ' ')} affects {outcome_label}, "
            f"{pattern_descs.get(pattern, pattern)}. "
            f"By usage level: {bucket_str}."
        )

        findings.append(
            Finding(
                type="dose_response",
                columns=[x_col, y_col],
                description=description,
                value=float(r),
                magnitude=min(abs(r) + 0.2, 1.0),
                confidence=min(len(sub) / 100, 1.0),
                extra={
                    "r": r,
                    "n": int(len(sub)),
                    "pattern": pattern,
                    "bins": bins,
                    "peak_bucket": peak_bucket,
                    "independent_var": x_col,
                    "dependent_var": y_col,
                    "outcome_label": outcome_label,
                    "used_pre_post": pre_col is not None,
                },
            )
        )
    return findings


def _comparison_findings(
    df: pd.DataFrame,
    question: str | None,
    relevant_cols: list[str],
    numeric_cols: list[str],
) -> list[Finding]:
    """For comparison questions (which group has the best X?), group by a categorical
    column in relevant_cols and compare a numeric metric across groups."""
    findings = []
    cat_cols = [c for c in relevant_cols if c not in numeric_cols and df[c].dtype == object]
    num_cols = [c for c in relevant_cols if c in numeric_cols]
    if not cat_cols or not num_cols:
        return findings

    for cat_col in cat_cols[:1]:
        for metric_col in num_cols[:3]:
            try:
                groups = df.groupby(cat_col)[metric_col].agg(["mean", "count"]).dropna()
                groups = groups[groups["count"] >= 5].sort_values("mean", ascending=False)
                if len(groups) < 2:
                    continue
                best = str(groups.index[0])
                best_val = float(groups.iloc[0]["mean"])
                leaderboard = {str(k): float(groups.loc[k, "mean"]) for k in groups.index[:5]}
                findings.append(
                    Finding(
                        type="ranking",
                        columns=[cat_col, metric_col],
                        description=(
                            f"{best} has the highest average {metric_col} ({best_val:,.2f}). "
                            f"Top groups: {', '.join(f'{k} ({v:,.2f})' for k, v in leaderboard.items())}."
                        ),
                        value=best_val,
                        magnitude=0.92,
                        confidence=0.85,
                        extra={
                            "top_entity": best,
                            "top_value": best_val,
                            "leaderboard": leaderboard,
                            "col": metric_col,
                            "is_combined": False,
                        },
                    )
                )
            except Exception:
                continue
    return findings


def _ranking_findings(
    df: pd.DataFrame, question: str | None, relevant_cols: list[str], force: bool = False
) -> list[Finding]:
    """For questions asking WHO or WHAT has the most/highest/best of something,
    compute a per-entity leaderboard and surface the top performers as a Finding."""
    if not relevant_cols:
        return []
    question_lower = question.lower() if question else ""
    if not force:
        if not question_lower:
            return []
        ranking_triggers = ["who", "most", "highest", "top", "best", "greatest", "leading", "leader", "impact"]
        if not any(t in question_lower for t in ranking_triggers):
            return []

    label_col = _label_column(df, _numeric_columns(df))
    if label_col is None:
        return []

    numeric_relevant = [c for c in relevant_cols if c in _numeric_columns(df)]
    if not numeric_relevant:
        return []

    findings = []

    def aggregate_col(col: str) -> "pd.Series":
        use_max = any(kw in col.lower() for kw in ["total", "tournament", "career", "season"])
        if use_max:
            return df.groupby(label_col)[col].max()
        return df.groupby(label_col)[col].sum()

    # Combined ranking when the question implies multiple metrics ("and", "combined", "both", "plus")
    if len(numeric_relevant) >= 2 and any(w in question_lower for w in ["and", "combined", "both", "plus"]):
        try:
            combined = None
            col_names_used = []
            for col in numeric_relevant:
                series = aggregate_col(col)
                combined = series if combined is None else combined.add(series, fill_value=0)
                col_names_used.append(col)

            if combined is not None and not combined.empty:
                top5 = combined.sort_values(ascending=False).head(5)
                top_entity = top5.index[0]
                top_value = top5.iloc[0]
                leaderboard = ", ".join(f"{name} ({val:,.0f})" for name, val in top5.items())
                combined_label = " + ".join(col_names_used)
                findings.append(
                    Finding(
                        type="ranking",
                        columns=[label_col] + col_names_used,
                        description=(
                            f"{top_entity} leads in combined {combined_label} with "
                            f"{top_value:,.0f} total contributions. "
                            f"Top 5: {leaderboard}."
                        ),
                        value=float(top_value),
                        magnitude=0.99,
                        confidence=0.95,
                        extra={
                            "top_entity": str(top_entity),
                            "top_value": float(top_value),
                            "leaderboard": {str(k): float(v) for k, v in top5.items()},
                            "combined_cols": col_names_used,
                            "is_combined": True,
                        },
                    )
                )
        except Exception:
            pass

    # Individual rankings per column
    for col in numeric_relevant:
        try:
            series = aggregate_col(col)
            if series.empty:
                continue
            top5 = series.sort_values(ascending=False).head(5)
            top_entity = top5.index[0]
            top_value = top5.iloc[0]
            leaderboard = ", ".join(f"{name} ({val:,.0f})" for name, val in top5.items())
            findings.append(
                Finding(
                    type="ranking",
                    columns=[label_col, col],
                    description=(
                        f"{top_entity} leads in {col} with {top_value:,.0f}. "
                        f"Top 5: {leaderboard}."
                    ),
                    value=float(top_value),
                    magnitude=0.95,
                    confidence=0.95,
                    extra={
                        "top_entity": str(top_entity),
                        "top_value": float(top_value),
                        "leaderboard": {str(k): float(v) for k, v in top5.items()},
                        "col": col,
                        "is_combined": False,
                    },
                )
            )
        except Exception:
            continue

    return findings


def analyze(
    df: pd.DataFrame,
    question: str | None = None,
    relevant_cols: list[str] | None = None,
    question_type: str | None = None,
    independent_var: str | None = None,
    dependent_var: str | None = None,
) -> list[Finding]:
    """Runs the full stats engine over a DataFrame and returns every candidate Finding."""
    numeric_cols = _numeric_columns(df)
    date_cols = _datetime_columns(df)
    label_col = _label_column(df, numeric_cols)

    if not relevant_cols:
        relevant_cols = _question_relevant_columns(df, question, numeric_cols)

    findings: list[Finding] = []

    if question_type == "ranking" or _is_ranking_question(question):
        findings += _ranking_findings(df, question, relevant_cols, force=(question_type == "ranking"))

    if question_type == "dose_response" or _is_dose_response_question(question):
        findings += _dose_response_findings(
            df, question, relevant_cols, numeric_cols,
            independent_var=independent_var,
            dependent_var=dependent_var,
        )

    if question_type == "comparison" or _is_comparison_question(question):
        findings += _comparison_findings(df, question, relevant_cols, numeric_cols)

    findings += _descriptive_findings(df, numeric_cols)
    findings += _trend_findings(df, numeric_cols, date_cols)
    findings += _outlier_findings(df, numeric_cols, label_col)
    findings += _correlation_findings(df, numeric_cols)
    findings += _distribution_findings(df, numeric_cols)
    findings.append(_data_quality_finding(df))
    return findings
