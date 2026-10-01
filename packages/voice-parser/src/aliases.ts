import type { ExerciseAliasResolver, ExerciseResolution, WorkoutContext } from "./types.js";

const GLOBAL_ALIASES: Record<string, string> = {
    bench: "bench_press",
    "bench press": "bench_press",
    "barbell bench": "bench_press",
    "barbell bench press": "bench_press",
    squat: "squat",
    squats: "squat",
    "leg curl": "leg_curl",
    "hamstring curl": "leg_curl",
    "leg curls": "leg_curl",
    "incline press": "incline_dumbbell_press",
    "incline dumbbell press": "incline_dumbbell_press",
};

export class DefaultExerciseAliasResolver implements ExerciseAliasResolver {
    resolve(phrase: string, context: WorkoutContext): ExerciseResolution {
        const normalized = phrase.trim().toLowerCase();
        if (!normalized) {
            return { confidence: 0 };
        }

        const candidates: Array<{ exerciseId: string; name: string; confidence: number }> = [];

        if (context.currentExercise) {
            const currentNames = [
                context.currentExercise.name.toLowerCase(),
                context.currentExercise.id.toLowerCase(),
                ...(context.currentExercise.aliases ?? []).map((a) => a.toLowerCase()),
            ];
            if (currentNames.some((name) => normalized.includes(name) || name.includes(normalized))) {
                candidates.push({
                    exerciseId: context.currentExercise.id,
                    name: context.currentExercise.name,
                    confidence: 0.95,
                });
            }
        }

        const globalId = GLOBAL_ALIASES[normalized];
        if (globalId) {
            candidates.push({ exerciseId: globalId, name: normalized, confidence: 0.9 });
        }

        for (const exercise of context.remainingExercises ?? []) {
            const names = [exercise.name.toLowerCase(), exercise.id.toLowerCase()];
            if (names.some((name) => normalized.includes(name) || name.includes(normalized))) {
                candidates.push({ exerciseId: exercise.id, name: exercise.name, confidence: 0.8 });
            }
        }

        if (candidates.length === 0) {
            return { confidence: 0 };
        }

        candidates.sort((a, b) => b.confidence - a.confidence);
        const best = candidates[0]!;
        return {
            exerciseId: best.exerciseId,
            name: best.name,
            confidence: best.confidence,
        };
    }
}

export const defaultExerciseAliasResolver = new DefaultExerciseAliasResolver();
