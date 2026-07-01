from src.services.analysis_service import Finding

# Baseline story-worthiness per finding type — outliers/trends/correlations make
# for a better hook than plain descriptive stats or housekeeping data-quality notes.
TYPE_WEIGHTS = {
    "ranking": 1.0,
    "dose_response": 1.0,
    "outlier": 1.0,
    "trend": 1.0,
    "correlation": 0.9,
    "distribution": 0.7,
    "descriptive": 0.4,
    "data_quality": 0.3,
}

SURPRISE_WEIGHT = 0.5
CONFIDENCE_WEIGHT = 0.3
TYPE_WEIGHT_FACTOR = 0.2


def rank_findings(
    findings: list[Finding],
    top_n: int = 5,
    relevant_cols: list[str] | None = None,
) -> list[Finding]:
    """Scores findings by surprise factor, business impact, and statistical
    confidence. Ranking findings and findings on question-relevant columns
    are always promoted to the top."""
    relevant_set = set(relevant_cols or [])

    def _is_trivial_correlation(f: Finding) -> bool:
        if f.type != "correlation" or len(f.columns) < 2:
            return False
        cols = [c.lower() for c in f.columns]
        for pre_p in ("pre_", "before_"):
            for post_p in ("post_", "after_"):
                a = cols[0].replace(pre_p, "").replace(post_p, "")
                b = cols[1].replace(pre_p, "").replace(post_p, "")
                if a == b:
                    return True
        return False

    def score(finding: Finding) -> float:
        if finding.type == "ranking":
            return 10.0
        if finding.type == "dose_response":
            return 9.0
        if _is_trivial_correlation(finding):
            return 0.1
        if finding.type == "outlier" and relevant_set and all(c in relevant_set for c in finding.columns):
            return 0.3
        base = (
            SURPRISE_WEIGHT * finding.magnitude
            + CONFIDENCE_WEIGHT * finding.confidence
            + TYPE_WEIGHT_FACTOR * TYPE_WEIGHTS.get(finding.type, 0.5)
        )
        if relevant_set and any(c in relevant_set for c in finding.columns):
            base *= 1.5
        return base

    scored = sorted(findings, key=score, reverse=True)
    return scored[:top_n]
