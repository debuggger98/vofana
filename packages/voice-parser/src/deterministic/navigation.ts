import type { WorkoutCommand } from "@vofana/workout-engine";
import type { ParseCandidate, WorkoutContext } from "../types.js";
import { CONFIDENCE } from "../confidence.js";

export interface NavigationParseResult {
    command: WorkoutCommand;
    confidence: number;
    interpretation: string;
    status: "PARSED";
}

export interface NavigationAmbiguity {
    confidence: number;
    reason: string;
    candidates: ParseCandidate[];
}

const NEXT_EXERCISE_PATTERNS = [
    /^next\s+exercise$/,
    /^next\s+exercise\s+please$/,
    /^go\s+to\s+next\s+exercise$/,
    /^go\s+to\s+the\s+next\s+(?:one|1)$/,
    /^next\s+(?:one|1)$/,
];

const NEXT_PATTERNS = [/^next$/, /^next\s+please$/];

const PREVIOUS_EXERCISE_PATTERNS = [
    /^previous\s+exercise$/,
    /^go\s+back$/,
    /^go\s+back\s+please$/,
    /^previous$/,
    /^last\s+exercise$/,
];

export function parseNavigation(
    text: string,
    _context: WorkoutContext,
): NavigationParseResult | NavigationAmbiguity | null {
    if (NEXT_EXERCISE_PATTERNS.some((p) => p.test(text))) {
        return {
            status: "PARSED",
            command: { type: "NEXT_EXERCISE" },
            confidence: CONFIDENCE.EXACT_PATTERN,
            interpretation: "NEXT_EXERCISE",
        };
    }

    if (NEXT_PATTERNS.some((p) => p.test(text))) {
        return {
            status: "PARSED",
            command: { type: "NEXT_EXERCISE" },
            confidence: CONFIDENCE.CONTEXT_INFERRED,
            interpretation: "NEXT_EXERCISE",
        };
    }

    if (PREVIOUS_EXERCISE_PATTERNS.some((p) => p.test(text))) {
        return {
            status: "PARSED",
            command: { type: "PREVIOUS_EXERCISE" },
            confidence: CONFIDENCE.EXACT_PATTERN,
            interpretation: "PREVIOUS_EXERCISE",
        };
    }

    return null;
}

export function parseSkip(
    text: string,
    _context: WorkoutContext,
): { command: WorkoutCommand; confidence: number; interpretation: string } | NavigationAmbiguity | null {
    const skipSetPatterns = [
        /^skip\s+this\s+set$/,
        /^skip\s+the\s+set$/,
        /^skip\s+set$/,
        /^next\s+set$/,
    ];
    const skipExercisePatterns = [
        /^skip\s+(?:the\s+)?exercise$/,
        /^skip\s+exercise$/,
        /^skip\s+this\s+exercise$/,
    ];
    const skipThisPatterns = [/^skip\s+this$/];
    const bareSkip = [/^skip$/];

    if (skipSetPatterns.some((p) => p.test(text))) {
        return {
            command: { type: "SKIP_SET" },
            confidence: CONFIDENCE.EXACT_PATTERN,
            interpretation: "SKIP_SET",
        };
    }

    if (skipExercisePatterns.some((p) => p.test(text))) {
        return {
            command: { type: "SKIP_EXERCISE" },
            confidence: CONFIDENCE.EXACT_PATTERN,
            interpretation: "SKIP_EXERCISE",
        };
    }

    if (skipThisPatterns.some((p) => p.test(text)) || bareSkip.some((p) => p.test(text))) {
        return {
            confidence: CONFIDENCE.AMBIGUOUS,
            reason: "Ambiguous between skipping current set and skipping exercise",
            candidates: [
                { command: { type: "SKIP_SET" }, confidence: 0.5 },
                { command: { type: "SKIP_EXERCISE" }, confidence: 0.45 },
            ],
        };
    }

    return null;
}
