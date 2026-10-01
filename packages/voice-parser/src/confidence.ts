export const CONFIDENCE = {
    EXACT_PATTERN: 0.99,
    CONTEXT_RESOLVED: 0.97,
    CONTEXT_INFERRED: 0.92,
    PARTIAL_CONTEXT: 0.75,
    WEAK_MATCH: 0.55,
    AMBIGUOUS: 0.48,
    UNSUPPORTED: 0.1,
} as const;

export function combineConfidence(...scores: number[]): number {
    if (scores.length === 0) return 0;
    const product = scores.reduce((acc, score) => acc * score, 1);
    return Math.round(product * 100) / 100;
}

export function clampConfidence(value: number): number {
    return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}
