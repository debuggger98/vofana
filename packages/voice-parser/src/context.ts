import type { WorkoutContext } from "./types.js";

export interface ResolvedWeight {
    weightKg: number;
    source: "spoken" | "planned" | "previous" | "previous_completed";
    confidence: number;
}

export function resolveWeight(
    context: WorkoutContext,
    options: {
        useSame?: boolean;
        spokenWeightKg?: number;
    } = {},
): ResolvedWeight | undefined {
    if (options.spokenWeightKg !== undefined) {
        return { weightKg: options.spokenWeightKg, source: "spoken", confidence: 0.99 };
    }

    if (options.useSame) {
        const previous =
            context.previousCompletedSet?.weightKg ??
            context.currentSet?.previousWeightKg ??
            context.currentSet?.plannedWeightKg;

        if (previous !== undefined) {
            return { weightKg: previous, source: "previous_completed", confidence: 0.97 };
        }
        return undefined;
    }

    const planned = context.currentSet?.plannedWeightKg ?? context.currentSet?.previousWeightKg;
    if (planned !== undefined) {
        return { weightKg: planned, source: "planned", confidence: 0.92 };
    }

    const fromLast = context.previousCompletedSet?.weightKg;
    if (fromLast !== undefined) {
        return { weightKg: fromLast, source: "previous_completed", confidence: 0.85 };
    }

    return undefined;
}

export function getLastCompletedSetId(context: WorkoutContext): string | undefined {
    return context.previousCompletedSet?.id;
}

export function isActiveWorkout(context: WorkoutContext): boolean {
    return context.workoutStatus === "ACTIVE";
}

export function hasCurrentSet(context: WorkoutContext): boolean {
    return context.currentSet !== undefined;
}
