import { describe, expect, it } from "vitest";
import { apply, createActiveWorkout, createWorkoutWithCompletedSet } from "./fixtures.js";

describe("Edit Set", () => {
    it("edits reps on a completed set while preserving identity", () => {
        const state = createWorkoutWithCompletedSet();
        const setId = state.exercises[0]!.sets[0]!.id;

        const result = apply(state, { type: "EDIT_SET", setId, reps: 9 });

        expect(result.success).toBe(true);
        const set = result.state.exercises[0]!.sets[0]!;
        expect(set.id).toBe(setId);
        expect(set.actualWeightKg).toBe(60);
        expect(set.actualReps).toBe(9);
        expect(result.events.some((e) => e.type === "SET_EDITED")).toBe(true);
        expect(result.state.completedSets[0]!.reps).toBe(9);
    });

    it("edits weight on a completed set", () => {
        const state = createWorkoutWithCompletedSet();
        const setId = state.exercises[0]!.sets[0]!.id;

        const result = apply(state, { type: "EDIT_SET", setId, weightKg: 62.5 });

        expect(result.success).toBe(true);
        expect(result.state.exercises[0]!.sets[0]!.actualWeightKg).toBe(62.5);
    });

    it("rejects editing a pending set", () => {
        const state = createActiveWorkout();
        const setId = state.exercises[0]!.sets[0]!.id;

        const result = apply(state, { type: "EDIT_SET", setId, reps: 9 });
        expect(result.success).toBe(false);
    });

    it("allows editing a completed set while paused", () => {
        let state = createWorkoutWithCompletedSet();
        const setId = state.exercises[0]!.sets[0]!.id;
        state = apply(state, { type: "PAUSE_WORKOUT" }).state;

        const result = apply(state, { type: "EDIT_SET", setId, reps: 8 });

        expect(result.success).toBe(true);
        expect(result.state.status).toBe("PAUSED");
        expect(result.state.exercises[0]!.sets[0]!.actualReps).toBe(8);
    });
});

describe("Change Planned Weight", () => {
    it("changes planned weight without modifying completed sets", () => {
        let state = createWorkoutWithCompletedSet();

        const completedBefore = { ...state.exercises[0]!.sets[0]! };
        const result = apply(state, { type: "CHANGE_WEIGHT", weightKg: 65 });

        expect(result.success).toBe(true);
        expect(result.state.exercises[0]!.sets[0]!.actualWeightKg).toBe(completedBefore.actualWeightKg);
        expect(result.state.exercises[0]!.sets[1]!.plannedWeightKg).toBe(65);
        expect(result.events.some((e) => e.type === "WEIGHT_CHANGED")).toBe(true);
    });
});

describe("Change Planned Reps", () => {
    it("changes planned reps for current pending set", () => {
        const state = createActiveWorkout();
        const result = apply(state, { type: "CHANGE_REPS", reps: 8 });

        expect(result.success).toBe(true);
        expect(result.state.exercises[0]!.sets[0]!.plannedReps).toBe(8);
        expect(result.events.some((e) => e.type === "REPS_CHANGED")).toBe(true);
    });
});

describe("Pause and Resume", () => {
    it("pauses and resumes an active workout", () => {
        let state = createActiveWorkout();

        let result = apply(state, { type: "PAUSE_WORKOUT" });
        expect(result.success).toBe(true);
        expect(result.state.status).toBe("PAUSED");

        result = apply(result.state, { type: "RESUME_WORKOUT" });
        expect(result.success).toBe(true);
        expect(result.state.status).toBe("ACTIVE");
    });
});

describe("End and Cancel", () => {
    it("ends workout from active state", () => {
        const state = createActiveWorkout();
        const result = apply(state, { type: "END_WORKOUT" });

        expect(result.success).toBe(true);
        expect(result.state.status).toBe("COMPLETED");
        expect(result.state.endedAt).toBeTruthy();
    });

    it("cancels workout from active state", () => {
        const state = createActiveWorkout();
        const result = apply(state, { type: "CANCEL_WORKOUT" });

        expect(result.success).toBe(true);
        expect(result.state.status).toBe("CANCELLED");
    });
});
