import type { WorkoutQueryIntent } from "@vofana/workout-engine";
import { CONFIDENCE } from "../confidence.js";

export interface QueryParseResult {
    intent: WorkoutQueryIntent;
    confidence: number;
}

const QUERY_PATTERNS: Array<{ intent: WorkoutQueryIntent; patterns: RegExp[] }> = [
    {
        intent: "WHAT_NEXT",
        patterns: [
            /^what(?:'s| is)\s+next\??$/,
            /^what\s+do\s+i\s+do\s+next\??$/,
            /^what\s+should\s+i\s+do\s+next\??$/,
            /^what\s+am\s+i\s+doing\s+next\??$/,
        ],
    },
    {
        intent: "SETS_REMAINING",
        patterns: [
            /^how\s+many\s+sets\s+(?:are\s+)?(?:left|remaining)\??$/,
            /^how\s+many\s+sets\s+do\s+i\s+have\s+left\??$/,
            /^sets\s+left\??$/,
            /^remaining\s+sets\??$/,
            /^how\s+many\s+sets\??$/,
        ],
    },
    {
        intent: "LAST_REPS",
        patterns: [
            /^how\s+many\s+reps\s+did\s+i\s+do\??$/,
            /^how\s+many\s+reps\s+was\s+that\??$/,
            /^what\s+reps\s+did\s+i\s+do\??$/,
            /^last\s+reps\??$/,
            /^how\s+many\s+reps\??$/,
        ],
    },
    {
        intent: "LAST_WEIGHT",
        patterns: [
            /^what\s+weight\s+did\s+i\s+use\??$/,
            /^what\s+weight\s+was\s+that\??$/,
            /^what\s+did\s+i\s+use\??$/,
            /^last\s+weight\??$/,
            /^what\s+weight\??$/,
        ],
    },
    {
        intent: "CURRENT_SET",
        patterns: [
            /^which\s+set\s+am\s+i\s+on\??$/,
            /^what\s+set\s+am\s+i\s+on\??$/,
            /^which\s+set\s+is\s+this\??$/,
            /^what\s+set\s+is\s+this\??$/,
            /^current\s+set\??$/,
        ],
    },
    {
        intent: "CURRENT_EXERCISE",
        patterns: [
            /^what\s+exercise\s+am\s+i\s+on\??$/,
            /^which\s+exercise\s+am\s+i\s+on\??$/,
            /^what\s+exercise\s+is\s+this\??$/,
            /^what\s+is\s+this\s+exercise\??$/,
            /^what\s+am\s+i\s+doing\??$/,
            /^current\s+exercise\??$/,
            /^what\s+exercise\??$/,
        ],
    },
];

export function parseQuery(text: string): QueryParseResult | null {
    for (const { intent, patterns } of QUERY_PATTERNS) {
        if (patterns.some((pattern) => pattern.test(text))) {
            return { intent, confidence: CONFIDENCE.CONTEXT_RESOLVED };
        }
    }
    return null;
}
