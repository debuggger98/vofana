import { describe, expect, it } from "vitest";
import { answerQuery, applyCommand, createWorkout, type WorkoutState } from "@vofana/workout-engine";
import { parseVoiceCommand } from "../src/parser.js";
import { workoutContextFromState } from "../src/from-state.js";

function createQueryWorkout(): WorkoutState {
    const created = createWorkout({
        sessionId: "query-session",
        userId: "query-user",
        workoutId: "query-workout",
        defaultRestSeconds: 90,
        exercises: [
            {
                exerciseId: "bench_press",
                name: "Bench Press",
                order: 0,
                target: { sets: 3, reps: { min: 8, max: 10 }, weightKg: 60 },
            },
            {
                exerciseId: "squat",
                name: "Squat",
                order: 1,
                target: { sets: 2, reps: { min: 5, max: 5 }, weightKg: 100 },
            },
        ],
    });
    const started = applyCommand(created, { type: "START_WORKOUT" });
    if (!started.success) {
        throw new Error(started.error?.message ?? "failed to start workout");
    }
    return started.state;
}

function parseQuery(state: WorkoutState, transcript: string) {
    return parseVoiceCommand({
        transcript,
        context: workoutContextFromState(state),
    });
}

describe("workout queries e2e", () => {
    it("answers roadmap questions without mutating", () => {
        let state = createQueryWorkout();
        const version = state.version;

        const next = parseQuery(state, "What's next?");
        expect(next.status).toBe("QUERY");
        expect(answerQuery(state, next.interpretation!.intent)).toContain("Bench Press set 1/");

        const exercise = parseQuery(state, "What exercise am I on?");
        expect(answerQuery(state, exercise.interpretation!.intent)).toBe("Bench Press");

        const whichSet = parseQuery(state, "Which set am I on?");
        expect(answerQuery(state, whichSet.interpretation!.intent)).toBe("Bench Press set 1/3");

        const setsLeft = parseQuery(state, "How many sets are left?");
        expect(answerQuery(state, setsLeft.interpretation!.intent)).toBe(
            "3 sets left on Bench Press, 5 sets in the workout.",
        );

        const noWeight = parseQuery(state, "What weight did I use?");
        expect(answerQuery(state, noWeight.interpretation!.intent)).toBe("No completed set yet.");

        expect(state.version).toBe(version);

        const logged = applyCommand(state, { type: "COMPLETE_SET", weightKg: 60, reps: 10, source: "VOICE" });
        expect(logged.success).toBe(true);
        state = logged.state;

        const afterVersion = state.version;
        const weight = parseQuery(state, "What weight did I use?");
        expect(answerQuery(state, weight.interpretation!.intent)).toBe("60 kg");

        const reps = parseQuery(state, "How many reps did I do?");
        expect(answerQuery(state, reps.interpretation!.intent)).toBe("10 reps");

        const remaining = parseQuery(state, "How many sets are left?");
        expect(answerQuery(state, remaining.interpretation!.intent)).toBe(
            "2 sets left on Bench Press, 4 sets in the workout.",
        );

        expect(state.version).toBe(afterVersion);
        expect(state.currentSetIndex).toBe(1);
    });
});
