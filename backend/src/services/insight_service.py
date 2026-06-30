from src.services.analysis_service import Finding

# Baseline story-worthiness per finding type — outliers/trends/correlations make
# for a better hook than plain descriptive stats or housekeeping data-quality notes.
TYPE_WEIGHTS = {
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


def score_finding(finding: Finding) -> float:
    type_weight = TYPE_WEIGHTS.get(finding.type, 0.5)
    return (
        SURPRISE_WEIGHT * finding.magnitude
        + CONFIDENCE_WEIGHT * finding.confidence
        + TYPE_WEIGHT_FACTOR * type_weight
    )


def rank_findings(findings: list[Finding], top_n: int = 5) -> list[Finding]:
    """Scores findings by surprise factor, business impact, and statistical
    confidence, returning the top N ranked most-to-least interesting."""
    scored = sorted(findings, key=score_finding, reverse=True)
    return scored[:top_n]
