from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd

CORRELATION_THRESHOLD = 0.5
SKEW_THRESHOLD = 1.0
IQR_MULTIPLIER = 1.5


@dataclass
class Finding:
    type: str  # descriptive | trend | outlier | correlation | distribution | data_quality
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
    return candidates[0] if candidates else None


def _descriptive_findings(df: pd.DataFrame, numeric_cols: list[str]) -> list[Finding]:
    findings = []
    for col in numeric_cols:
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
    for col in numeric_cols:
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
    for col in numeric_cols:
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


def analyze(df: pd.DataFrame) -> list[Finding]:
    """Runs the full stats engine over a DataFrame and returns every candidate Finding."""
    numeric_cols = _numeric_columns(df)
    date_cols = _datetime_columns(df)
    label_col = _label_column(df, numeric_cols)

    findings: list[Finding] = []
    findings += _descriptive_findings(df, numeric_cols)
    findings += _trend_findings(df, numeric_cols, date_cols)
    findings += _outlier_findings(df, numeric_cols, label_col)
    findings += _correlation_findings(df, numeric_cols)
    findings += _distribution_findings(df, numeric_cols)
    findings.append(_data_quality_finding(df))
    return findings
