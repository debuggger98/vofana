import type { WorkoutCommand } from "@vofana/workout-engine";
import type { WorkoutContext } from "../types.js";
import { CONFIDENCE } from "../confidence.js";
import { extractWeightKg, parseNumberToken } from "../normalize.js";

export interface ControlParseResult {
    command: WorkoutCommand;
    confidence: number;
    interpretation: string;
}

export interface ControlAmbiguity {
    confidence: number;
    reason: string;
}

export function parseUndo(text: string): ControlParseResult | null {
    const patterns = [
        /^undo$/,
        /^undo\s+that$/,
        /^cancel\s+that$/,
        /^reverse\s+that$/,
        /^i\s+accidentally\s+logged\s+that\s+twice$/,
        /^accidentally\s+logged\s+that\s+twice$/,
        /^i\s+logged\s+that\s+twice(?:\s+accidentally)?$/,
        /^logged\s+that\s+twice$/,
    ];
    if (patterns.some((p) => p.test(text))) {
        return {
            command: { type: "UNDO" },
            confidence: CONFIDENCE.EXACT_PATTERN,
            interpretation: "UNDO",
        };
    }
    return null;
}

export function parseWorkoutControl(text: string): ControlParseResult | null {
    const controls: Array<{ patterns: RegExp[]; command: WorkoutCommand; interpretation: string }> = [
        {
            patterns: [/^start\s+workout$/, /^begin\s+workout$/],
            command: { type: "START_WORKOUT" },
            interpretation: "START_WORKOUT",
        },
        {
            patterns: [
                /^pause$/,
                /^pause\s+workout$/,
                /^pause\s+the\s+workout$/,
                /^pause\s+please$/,
                /^hold\s+on$/,
                /^wait$/,
                /^wait\s+a\s+second$/,
            ],
            command: { type: "PAUSE_WORKOUT" },
            interpretation: "PAUSE_WORKOUT",
        },
        {
            patterns: [
                /^resume$/,
                /^resume\s+workout$/,
                /^continue$/,
                /^keep\s+going$/,
                /^let's\s+continue$/,
                /^lets\s+continue$/,
            ],
            command: { type: "RESUME_WORKOUT" },
            interpretation: "RESUME_WORKOUT",
        },
        {
            patterns: [/^end\s+workout$/, /^finish\s+workout$/, /^finish$/],
            command: { type: "END_WORKOUT" },
            interpretation: "END_WORKOUT",
        },
        {
            patterns: [/^cancel\s+workout$/, /^abort\s+workout$/],
            command: { type: "CANCEL_WORKOUT" },
            interpretation: "CANCEL_WORKOUT",
        },
    ];

    for (const control of controls) {
        if (control.patterns.some((p) => p.test(text))) {
            return {
                command: control.command,
                confidence: CONFIDENCE.EXACT_PATTERN,
                interpretation: control.interpretation,
            };
        }
    }

    return null;
}

export function parseRestControl(
    text: string,
    context: WorkoutContext,
): ControlParseResult | ControlAmbiguity | null {
    if (/^skip\s+rest$/.test(text) || /^skip\s+the\s+timer$/.test(text)) {
        return {
            command: { type: "SKIP_REST" },
            confidence: CONFIDENCE.EXACT_PATTERN,
            interpretation: "SKIP_REST",
        };
    }

    const startRestMatch = text.match(/^start\s+(?:a\s+)?(?:(\d+)\s+second\s+)?rest$/);
    if (startRestMatch || /^start\s+rest$/.test(text)) {
        const duration = startRestMatch?.[1] ? Number(startRestMatch[1]) : undefined;
        return {
            command: { type: "START_REST", ...(duration !== undefined ? { durationSeconds: duration } : {}) },
            confidence: CONFIDENCE.EXACT_PATTERN,
            interpretation: "START_REST",
        };
    }

    const addSecondsMatch = text.match(/^add\s+(\d+)\s+seconds?$/);
    if (addSecondsMatch) {
        const delta = Number(addSecondsMatch[1]);
        const currentDuration =
            context.restState?.status === "RUNNING"
                ? context.restState.durationSeconds
                : context.defaultRestSeconds;

        if (currentDuration === undefined) {
            return {
                confidence: CONFIDENCE.AMBIGUOUS,
                reason: "Cannot determine current rest duration to add seconds",
            };
        }

        return {
            command: { type: "CHANGE_REST", durationSeconds: currentDuration + delta },
            confidence: CONFIDENCE.CONTEXT_INFERRED,
            interpretation: "CHANGE_REST",
        };
    }

    return null;
}

export function parseWeightChange(
    text: string,
    context: WorkoutContext,
): ControlParseResult | ControlAmbiguity | null {
    const units = context.units ?? "KG";

    const patterns: Array<{ regex: RegExp; kind: "absolute" | "increase" | "decrease"; requiresContext?: boolean }> = [
        { regex: /^(?:increase|change|set)\s+(?:it\s+)?to\s+(\d+(?:\.\d+)?)\s*(?:kg|lb)?$/, kind: "absolute" },
        { regex: /^(?:let's go|lets go)\s+to\s+(\d+(?:\.\d+)?)\s*(?:kg|lb)?$/, kind: "absolute" },
        { regex: /^(?:increase|bump)\s+to\s+(\d+(?:\.\d+)?)\s*(?:kg|lb)?$/, kind: "absolute" },
        { regex: /^(?:reduce|decrease)\s+(?:it\s+)?(?:a\s+bit|slightly)$/, kind: "decrease" },
        { regex: /^make\s+it\s+better$/, kind: "decrease" },
        { regex: /^make\s+it\s+(\d+(?:\.\d+)?)\s*(?:kg|lb)?$/, kind: "absolute", requiresContext: true },
    ];

    for (const { regex, kind, requiresContext } of patterns) {
        const match = text.match(regex);
        if (!match) continue;

        if (kind === "decrease") {
            return {
                confidence: CONFIDENCE.AMBIGUOUS,
                reason: "Relative weight change without explicit value",
            };
        }

        if (requiresContext) {
            const hasPlannedWeight = context.currentSet?.plannedWeightKg !== undefined;
            const hasPreviousWeight = context.previousCompletedSet?.weightKg !== undefined;
            if (!hasPlannedWeight && !hasPreviousWeight) {
                return {
                    confidence: CONFIDENCE.AMBIGUOUS,
                    reason: "Ambiguous whether weight change applies to current or previous set",
                };
            }
        }

        const weightKg = extractWeightKg(match[0], units);
        if (weightKg === undefined) {
            return {
                confidence: CONFIDENCE.AMBIGUOUS,
                reason: "Could not parse target weight",
            };
        }

        return {
            command: { type: "CHANGE_WEIGHT", weightKg },
            confidence: requiresContext ? CONFIDENCE.CONTEXT_INFERRED : CONFIDENCE.EXACT_PATTERN,
            interpretation: "CHANGE_WEIGHT",
        };
    }

    const repsChange = text.match(/^(?:change|set)\s+reps?\s+to\s+(\d+)$/);
    if (repsChange) {
        const reps = parseNumberToken(repsChange[1]!);
        if (reps !== undefined) {
            return {
                command: { type: "CHANGE_REPS", reps },
                confidence: CONFIDENCE.EXACT_PATTERN,
                interpretation: "CHANGE_REPS",
            };
        }
    }

    return null;
}
