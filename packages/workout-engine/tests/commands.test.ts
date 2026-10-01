import { describe, expect, it } from "vitest";
import type { WorkoutCommand } from "../src/commands.js";
import { apply, createActiveWorkout } from "./fixtures.js";

describe("Command surface", () => {
    const commands: WorkoutCommand[] = [
        { type: "START_WORKOUT" },
        { type: "PAUSE_WORKOUT" },
        { type: "RESUME_WORKOUT" },
        { type: "COMPLETE_SET", weightKg: 60, reps: 10 },
        { type: "EDIT_SET", setId: "set-1", reps: 9 },
        { type: "UNDO" },
        { type: "SKIP_SET" },
        { type: "SKIP_EXERCISE" },
        { type: "CHANGE_WEIGHT", weightKg: 65 },
        { type: "CHANGE_REPS", reps: 8 },
        { type: "START_REST" },
        { type: "SKIP_REST" },
        { type: "CHANGE_REST", durationSeconds: 120 },
        { type: "NEXT_EXERCISE" },
        { type: "PREVIOUS_EXERCISE" },
        { type: "END_WORKOUT" },
        { type: "CANCEL_WORKOUT" },
    ];

    it("has all required command types defined", () => {
        const types = commands.map((c) => c.type);
        expect(types).toContain("START_WORKOUT");
        expect(types).toContain("COMPLETE_SET");
        expect(types).toContain("UNDO");
        expect(types).toContain("SKIP_SET");
        expect(types).toContain("SKIP_EXERCISE");
        expect(types).toContain("CHANGE_WEIGHT");
        expect(types).toContain("CHANGE_REPS");
        expect(types).toContain("END_WORKOUT");
        expect(types.length).toBe(17);
    });

    it("CHANGE_REST updates default rest duration", () => {
        const state = createActiveWorkout();
        const result = apply(state, { type: "CHANGE_REST", durationSeconds: 120 });
        expect(result.success).toBe(true);
        expect(result.state.defaultRestSeconds).toBe(120);
    });

    it("START_REST with custom duration", () => {
        const state = createActiveWorkout();
        const result = apply(state, { type: "START_REST", durationSeconds: 60 });
        expect(result.success).toBe(true);
        expect(result.effects).toContainEqual({ type: "START_REST_TIMER", durationSeconds: 60 });
    });
});
