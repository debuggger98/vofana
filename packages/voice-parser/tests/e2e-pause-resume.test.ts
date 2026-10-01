import { describe, expect, it } from "vitest";
import {
    applyCommand,
    createWorkout,
    describeNextAction,
    type WorkoutState,
} from "@vofana/workout-engine";
import { parseVoiceCommand } from "../src/parser.js";
import { workoutContextFromState } from "../src/from-state.js";

function createPauseWorkout(): WorkoutState {
    const created = createWorkout({
        sessionId: "pause-session",
        userId: "pause-user",
        workoutId: "pause-workout",
        defaultRestSeconds: 90,
        exercises: [
            {
                exerciseId: "bench_press",
                name: "Bench Press",
                order: 0,
                target: { sets: 2, reps: { min: 8, max: 10 }, weightKg: 60 },
            },
        ],
    });
    const started = applyCommand(created, { type: "START_WORKOUT" });
    if (!started.success) {
        throw new Error(started.error?.message ?? "failed to start workout");
    }
    return started.state;
}

function applyTranscript(state: WorkoutState, transcript: string) {
    const parsed = parseVoiceCommand({
        transcript,
        context: workoutContextFromState(state),
    });
    return { parsed, result: parsed.command ? applyCommand(state, parsed.command) : undefined };
}

describe("pause and resume e2e", () => {
    it("pauses on hold on and rejects logging until resume", () => {
        let state = createPauseWorkout();

        const paused = applyTranscript(state, "hold on");
        expect(paused.parsed.command).toEqual({ type: "PAUSE_WORKOUT" });
        expect(paused.result?.success).toBe(true);
        state = paused.result!.state;
        expect(state.status).toBe("PAUSED");
        expect(describeNextAction(state)).toBe('Say "resume".');

        const logged = applyTranscript(state, "Finished 10.");
        expect(logged.parsed.command?.type).toBe("COMPLETE_SET");
        expect(logged.result?.success).toBe(false);
        expect(logged.result?.error?.code).toBe("WORKOUT_NOT_ACTIVE");
        expect(logged.result?.state.completedSets).toHaveLength(0);

        const resumed = applyTranscript(state, "keep going");
        expect(resumed.parsed.command).toEqual({ type: "RESUME_WORKOUT" });
        expect(resumed.result?.success).toBe(true);
        state = resumed.result!.state;
        expect(state.status).toBe("ACTIVE");

        const after = applyTranscript(state, "Finished 10.");
        expect(after.result?.success).toBe(true);
        expect(after.result!.state.completedSets).toHaveLength(1);
    });

    it("what's next while paused does not mutate", () => {
        let state = createPauseWorkout();
        state = applyTranscript(state, "pause").result!.state;
        const version = state.version;
        const { parsed, result } = applyTranscript(state, "what's next?");
        expect(parsed.interpretation?.intent).toBe("WHAT_NEXT");
        expect(parsed.status).toBe("QUERY");
        expect(result).toBeUndefined();
        expect(state.version).toBe(version);
    });
});
