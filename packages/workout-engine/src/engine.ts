import type { WorkoutCommand } from "./commands.js";
import type { WorkoutEffect } from "./effects.js";
import type { WorkoutEvent } from "./events.js";
import { createError } from "./errors.js";
import {
    bumpVersion,
    cloneState,
    findLastCompletedSet,
    findSetById,
    getCurrentExercise,
    getCurrentSet,
    isWorkoutActive,
    isWorkoutFinished,
} from "./helpers.js";
import { generateId } from "./id.js";
import { getProgressionRecommendation } from "./progression.js";
import type {
    CommandResult,
    CompletedSetRecord,
    SetSource,
    WorkoutRecommendation,
    WorkoutState,
} from "./types.js";
import { validateReps, validateRestDuration, validateWeight } from "./validators.js";

interface ReduceContext {
    timestamp: string;
    events: WorkoutEvent[];
    effects: WorkoutEffect[];
    recommendations: WorkoutRecommendation[];
}

function fail(
    state: WorkoutState,
    error: ReturnType<typeof createError>,
    ctx: ReduceContext,
): CommandResult {
    return {
        success: false,
        state,
        events: ctx.events,
        effects: ctx.effects,
        recommendations: ctx.recommendations,
        error,
    };
}

function succeed(state: WorkoutState, ctx: ReduceContext): CommandResult {
    return {
        success: true,
        state,
        events: ctx.events,
        effects: ctx.effects,
        recommendations: ctx.recommendations,
    };
}

function createEvent(
    state: WorkoutState,
    type: WorkoutEvent["type"],
    payload: Omit<WorkoutEvent, "eventId" | "sessionId" | "timestamp" | "sequence" | "type">,
    ctx: ReduceContext,
): WorkoutEvent {
    const event = {
        eventId: generateId("evt"),
        sessionId: state.sessionId,
        timestamp: ctx.timestamp,
        sequence: state.version + 1,
        type,
        ...payload,
    } as WorkoutEvent;
    ctx.events.push(event);
    return event;
}

function saveUndoSnapshot(state: WorkoutState): WorkoutState {
    const snapshot = cloneState(state);
    delete snapshot.undoSnapshot;
    return { ...state, undoSnapshot: snapshot };
}

function markCommandProcessed(state: WorkoutState, commandId?: string): WorkoutState {
    if (!commandId) {
        return state;
    }
    return {
        ...state,
        processedCommandIds: [...state.processedCommandIds, commandId],
    };
}

function checkIdempotency(state: WorkoutState, command: WorkoutCommand, ctx: ReduceContext): CommandResult | null {
    if (command.commandId && state.processedCommandIds.includes(command.commandId)) {
        return succeed(state, ctx);
    }
    return null;
}

function requireActive(state: WorkoutState, ctx: ReduceContext): CommandResult | null {
    if (!isWorkoutActive(state)) {
        return fail(state, createError("WORKOUT_NOT_ACTIVE", `Workout is ${state.status}, expected ACTIVE`), ctx);
    }
    return null;
}

function requireActiveOrPaused(state: WorkoutState, ctx: ReduceContext): CommandResult | null {
    if (state.status === "ACTIVE" || state.status === "PAUSED") {
        return null;
    }
    return fail(
        state,
        createError("WORKOUT_NOT_ACTIVE", `Workout is ${state.status}, expected ACTIVE or PAUSED`),
        ctx,
    );
}

function completeWorkoutIfDone(state: WorkoutState, ctx: ReduceContext): WorkoutState {
    if (isWorkoutFinished(state) && state.status === "ACTIVE") {
        const completed = {
            ...state,
            status: "COMPLETED" as const,
            endedAt: ctx.timestamp,
        };
        createEvent(completed, "WORKOUT_COMPLETED", {}, ctx);
        return completed;
    }
    return state;
}

function resolveSetValues(
    state: WorkoutState,
    weightKg?: number,
    reps?: number,
): { weightKg: number; reps: number } | { error: ReturnType<typeof createError> } {
    const currentSet = getCurrentSet(state);
    if (!currentSet) {
        return { error: createError("NO_CURRENT_SET", "No current set to complete") };
    }

    const resolvedWeight = weightKg ?? currentSet.plannedWeightKg ?? currentSet.actualWeightKg;
    const resolvedReps = reps ?? currentSet.plannedReps ?? currentSet.actualReps;

    if (resolvedWeight === undefined) {
        return { error: createError("INVALID_SET_DATA", "Weight is required and could not be resolved from context") };
    }
    if (resolvedReps === undefined) {
        return { error: createError("INVALID_SET_DATA", "Reps are required and could not be resolved from context") };
    }

    const weightValidation = validateWeight(resolvedWeight);
    if (!weightValidation.valid) {
        return { error: weightValidation.error };
    }
    const repsValidation = validateReps(resolvedReps);
    if (!repsValidation.valid) {
        return { error: repsValidation.error };
    }

    return { weightKg: resolvedWeight, reps: resolvedReps };
}

function updateSetInState(
    state: WorkoutState,
    exerciseIndex: number,
    setIndex: number,
    updater: (set: (typeof state.exercises)[0]["sets"][0]) => (typeof state.exercises)[0]["sets"][0],
): WorkoutState {
    const exercises = state.exercises.map((ex, ei) => {
        if (ei !== exerciseIndex) return ex;
        return {
            ...ex,
            sets: ex.sets.map((s, si) => (si === setIndex ? updater(s) : s)),
        };
    });
    return { ...state, exercises };
}

function handleStartWorkout(state: WorkoutState, ctx: ReduceContext): CommandResult {
    if (state.status !== "NOT_STARTED") {
        return fail(
            state,
            createError("INVALID_STATE_TRANSITION", `Cannot start workout from status ${state.status}`),
            ctx,
        );
    }

    const exercises = state.exercises.map((ex, i) =>
        i === 0 ? { ...ex, status: "IN_PROGRESS" as const } : ex,
    );

    let newState: WorkoutState = {
        ...state,
        status: "ACTIVE",
        startedAt: ctx.timestamp,
        exercises,
        currentExerciseIndex: 0,
        currentSetIndex: 0,
    };
    newState = bumpVersion(newState);
    createEvent(newState, "WORKOUT_STARTED", { workoutId: state.workoutId }, ctx);
    return succeed(newState, ctx);
}

function handlePauseWorkout(state: WorkoutState, ctx: ReduceContext): CommandResult {
    if (state.status === "PAUSED") {
        return succeed(state, ctx);
    }
    if (state.status !== "ACTIVE") {
        return fail(state, createError("INVALID_STATE_TRANSITION", `Cannot pause from status ${state.status}`), ctx);
    }
    let newState = bumpVersion({ ...state, status: "PAUSED" });
    if (state.restState.status === "RUNNING") {
        ctx.effects.push({ type: "STOP_REST_TIMER" });
    }
    createEvent(newState, "WORKOUT_PAUSED", {}, ctx);
    return succeed(newState, ctx);
}

function handleResumeWorkout(state: WorkoutState, ctx: ReduceContext): CommandResult {
    if (state.status === "ACTIVE") {
        return succeed(state, ctx);
    }
    if (state.status !== "PAUSED") {
        return fail(state, createError("INVALID_STATE_TRANSITION", `Cannot resume from status ${state.status}`), ctx);
    }
    let newState = bumpVersion({ ...state, status: "ACTIVE" });
    if (state.restState.status === "RUNNING" && state.restState.durationSeconds !== undefined) {
        ctx.effects.push({
            type: "START_REST_TIMER",
            durationSeconds: state.restState.durationSeconds,
        });
    }
    createEvent(newState, "WORKOUT_RESUMED", {}, ctx);
    return succeed(newState, ctx);
}

function handleCompleteSet(
    state: WorkoutState,
    weightKg: number | undefined,
    reps: number | undefined,
    source: SetSource | undefined,
    ctx: ReduceContext,
): CommandResult {
    const activeCheck = requireActive(state, ctx);
    if (activeCheck) return activeCheck;

    const currentSet = getCurrentSet(state);
    const currentExercise = getCurrentExercise(state);
    if (!currentSet || !currentExercise) {
        return fail(state, createError("NO_CURRENT_SET", "No current set to complete"), ctx);
    }
    if (currentSet.status !== "PENDING") {
        return fail(state, createError("INVALID_COMMAND", "Current set is not pending"), ctx);
    }

    const resolved = resolveSetValues(state, weightKg, reps);
    if ("error" in resolved) {
        return fail(state, resolved.error, ctx);
    }

    let newState = saveUndoSnapshot(state);
    const completedAt = ctx.timestamp;

    newState = updateSetInState(newState, state.currentExerciseIndex, state.currentSetIndex, (set) => ({
        ...set,
        status: "COMPLETED",
        actualWeightKg: resolved.weightKg,
        actualReps: resolved.reps,
        source: source ?? "MANUAL",
        completedAt,
    }));

    const completedRecord: CompletedSetRecord = {
        exerciseId: currentExercise.exerciseId,
        setId: currentSet.id,
        setNumber: currentSet.setNumber,
        weightKg: resolved.weightKg,
        reps: resolved.reps,
        completedAt,
        source: source ?? "MANUAL",
    };
    newState = {
        ...newState,
        completedSets: [...newState.completedSets, completedRecord],
    };

    newState = bumpVersion(newState);
    createEvent(newState, "SET_COMPLETED", {
        exerciseId: currentExercise.exerciseId,
        setId: currentSet.id,
        weightKg: resolved.weightKg,
        reps: resolved.reps,
        source: source ?? "MANUAL",
    }, ctx);

    const recommendation = getProgressionRecommendation({
        exercise: currentExercise,
        actualWeightKg: resolved.weightKg,
        actualReps: resolved.reps,
    });
    ctx.recommendations.push(recommendation);

    // Advance position
    newState = advanceAfterSetAction(newState, ctx);
    newState = completeWorkoutIfDone(newState, ctx);

    // Rest effect (unless workout just completed)
    if (newState.status === "ACTIVE" && !isWorkoutFinished(newState)) {
        const restDuration = newState.defaultRestSeconds;
        newState = {
            ...newState,
            restState: {
                status: "RUNNING",
                startedAt: ctx.timestamp,
                durationSeconds: restDuration,
            },
        };
        ctx.effects.push({ type: "START_REST_TIMER", durationSeconds: restDuration });
        createEvent(newState, "REST_STARTED", { durationSeconds: restDuration }, ctx);
    }

    return succeed(newState, ctx);
}

function advanceAfterSetAction(state: WorkoutState, ctx: ReduceContext): WorkoutState {
    let newState = { ...state };
    const exercise = newState.exercises[newState.currentExerciseIndex];
    if (!exercise) return newState;

    if (newState.currentSetIndex + 1 < exercise.sets.length) {
        return { ...newState, currentSetIndex: newState.currentSetIndex + 1 };
    }

    // Mark exercise completed
    const updatedExercises = newState.exercises.map((ex, i) =>
        i === newState.currentExerciseIndex ? { ...ex, status: "COMPLETED" as const } : ex,
    );
    newState = { ...newState, exercises: updatedExercises };

    createEvent(newState, "EXERCISE_COMPLETED", { exerciseId: exercise.exerciseId }, ctx);

    if (newState.currentExerciseIndex + 1 < newState.exercises.length) {
        const nextIndex = newState.currentExerciseIndex + 1;
        const nextExercises = newState.exercises.map((ex, i) =>
            i === nextIndex && ex.status === "PENDING" ? { ...ex, status: "IN_PROGRESS" as const } : ex,
        );
        return {
            ...newState,
            exercises: nextExercises,
            currentExerciseIndex: nextIndex,
            currentSetIndex: 0,
        };
    }

    return newState;
}

function handleSkipSet(state: WorkoutState, ctx: ReduceContext): CommandResult {
    const activeCheck = requireActive(state, ctx);
    if (activeCheck) return activeCheck;

    const currentSet = getCurrentSet(state);
    const currentExercise = getCurrentExercise(state);
    if (!currentSet || !currentExercise) {
        return fail(state, createError("NO_CURRENT_SET", "No current set to skip"), ctx);
    }

    let newState = saveUndoSnapshot(state);
    newState = updateSetInState(newState, state.currentExerciseIndex, state.currentSetIndex, (set) => ({
        ...set,
        status: "SKIPPED",
    }));
    newState = bumpVersion(newState);
    createEvent(newState, "SET_SKIPPED", {
        exerciseId: currentExercise.exerciseId,
        setId: currentSet.id,
    }, ctx);

    newState = advanceAfterSetAction(newState, ctx);
    newState = completeWorkoutIfDone(newState, ctx);
    return succeed(newState, ctx);
}

function handleSkipExercise(state: WorkoutState, ctx: ReduceContext): CommandResult {
    const activeCheck = requireActive(state, ctx);
    if (activeCheck) return activeCheck;

    const currentExercise = getCurrentExercise(state);
    if (!currentExercise) {
        return fail(state, createError("EXERCISE_NOT_FOUND", "No current exercise to skip"), ctx);
    }

    let newState = saveUndoSnapshot(state);
    const updatedExercises = newState.exercises.map((ex, i) => {
        if (i !== state.currentExerciseIndex) return ex;
        return {
            ...ex,
            status: "SKIPPED" as const,
            sets: ex.sets.map((s) =>
                s.status === "PENDING" ? { ...s, status: "SKIPPED" as const } : s,
            ),
        };
    });
    newState = { ...newState, exercises: updatedExercises };
    newState = bumpVersion(newState);
    createEvent(newState, "EXERCISE_SKIPPED", { exerciseId: currentExercise.exerciseId }, ctx);

    if (state.currentExerciseIndex + 1 < state.exercises.length) {
        const nextIndex = state.currentExerciseIndex + 1;
        const nextExercises = newState.exercises.map((ex, i) =>
            i === nextIndex && ex.status === "PENDING" ? { ...ex, status: "IN_PROGRESS" as const } : ex,
        );
        newState = {
            ...newState,
            exercises: nextExercises,
            currentExerciseIndex: nextIndex,
            currentSetIndex: 0,
        };
    } else {
        newState = { ...newState, status: "COMPLETED", endedAt: ctx.timestamp };
        createEvent(newState, "WORKOUT_COMPLETED", {}, ctx);
    }

    return succeed(newState, ctx);
}

function handleEditSet(
    state: WorkoutState,
    setId: string,
    weightKg: number | undefined,
    reps: number | undefined,
    ctx: ReduceContext,
): CommandResult {
    const sessionCheck = requireActiveOrPaused(state, ctx);
    if (sessionCheck) return sessionCheck;

    const found = findSetById(state, setId);
    if (!found) {
        return fail(state, createError("SET_NOT_FOUND", `Set ${setId} not found`), ctx);
    }
    if (found.set.status !== "COMPLETED") {
        return fail(state, createError("INVALID_COMMAND", "Can only edit completed sets"), ctx);
    }

    const newWeight = weightKg ?? found.set.actualWeightKg;
    const newReps = reps ?? found.set.actualReps;

    if (newWeight === undefined || newReps === undefined) {
        return fail(state, createError("INVALID_SET_DATA", "Both weight and reps must be resolvable for edit"), ctx);
    }

    const weightValidation = validateWeight(newWeight);
    if (!weightValidation.valid) return fail(state, weightValidation.error, ctx);
    const repsValidation = validateReps(newReps);
    if (!repsValidation.valid) return fail(state, repsValidation.error, ctx);

    let newState = saveUndoSnapshot(state);
    newState = updateSetInState(newState, found.exerciseIndex, found.setIndex, (set) => ({
        ...set,
        actualWeightKg: newWeight,
        actualReps: newReps,
    }));

    newState = {
        ...newState,
        completedSets: newState.completedSets.map((cs) =>
            cs.setId === setId ? { ...cs, weightKg: newWeight, reps: newReps } : cs,
        ),
    };

    newState = bumpVersion(newState);
    createEvent(newState, "SET_EDITED", {
        exerciseId: found.exercise.exerciseId,
        setId,
        weightKg: newWeight,
        reps: newReps,
    }, ctx);

    return succeed(newState, ctx);
}

function handleUndo(state: WorkoutState, ctx: ReduceContext): CommandResult {
    if (!state.undoSnapshot) {
        return fail(state, createError("NOTHING_TO_UNDO", "No undoable action available"), ctx);
    }

    const snapshot = cloneState(state.undoSnapshot);
    delete snapshot.undoSnapshot;

    const lastCompleted = findLastCompletedSet(state);
    let newState = bumpVersion(snapshot);
    if (lastCompleted) {
        createEvent(newState, "SET_UNDONE", {
            exerciseId: lastCompleted.exercise.exerciseId,
            setId: lastCompleted.set.id,
        }, ctx);
    }

    return succeed(newState, ctx);
}

function handleChangeWeight(state: WorkoutState, weightKg: number, ctx: ReduceContext): CommandResult {
    const activeCheck = requireActive(state, ctx);
    if (activeCheck) return activeCheck;

    const weightValidation = validateWeight(weightKg);
    if (!weightValidation.valid) return fail(state, weightValidation.error, ctx);

    const currentSet = getCurrentSet(state);
    const currentExercise = getCurrentExercise(state);
    if (!currentSet || !currentExercise) {
        return fail(state, createError("NO_CURRENT_SET", "No current set to change weight for"), ctx);
    }
    if (currentSet.status !== "PENDING") {
        return fail(state, createError("INVALID_COMMAND", "Can only change planned weight for pending sets"), ctx);
    }

    let newState = saveUndoSnapshot(state);
    newState = updateSetInState(newState, state.currentExerciseIndex, state.currentSetIndex, (set) => ({
        ...set,
        plannedWeightKg: weightKg,
    }));

    const updatedExercises = newState.exercises.map((ex, i) =>
        i === state.currentExerciseIndex
            ? { ...ex, target: { ...ex.target, weightKg } }
            : ex,
    );
    newState = { ...newState, exercises: updatedExercises };
    newState = bumpVersion(newState);
    createEvent(newState, "WEIGHT_CHANGED", {
        exerciseId: currentExercise.exerciseId,
        setId: currentSet.id,
        weightKg,
    }, ctx);

    return succeed(newState, ctx);
}

function handleChangeReps(state: WorkoutState, reps: number, ctx: ReduceContext): CommandResult {
    const activeCheck = requireActive(state, ctx);
    if (activeCheck) return activeCheck;

    const repsValidation = validateReps(reps);
    if (!repsValidation.valid) return fail(state, repsValidation.error, ctx);

    const currentSet = getCurrentSet(state);
    const currentExercise = getCurrentExercise(state);
    if (!currentSet || !currentExercise) {
        return fail(state, createError("NO_CURRENT_SET", "No current set to change reps for"), ctx);
    }
    if (currentSet.status !== "PENDING") {
        return fail(state, createError("INVALID_COMMAND", "Can only change planned reps for pending sets"), ctx);
    }

    let newState = saveUndoSnapshot(state);
    newState = updateSetInState(newState, state.currentExerciseIndex, state.currentSetIndex, (set) => ({
        ...set,
        plannedReps: reps,
    }));
    newState = bumpVersion(newState);
    createEvent(newState, "REPS_CHANGED", {
        exerciseId: currentExercise.exerciseId,
        setId: currentSet.id,
        reps,
    }, ctx);

    return succeed(newState, ctx);
}

function handleStartRest(state: WorkoutState, durationSeconds: number | undefined, ctx: ReduceContext): CommandResult {
    const activeCheck = requireActive(state, ctx);
    if (activeCheck) return activeCheck;

    const duration = durationSeconds ?? state.defaultRestSeconds;
    const durationValidation = validateRestDuration(duration);
    if (!durationValidation.valid) return fail(state, durationValidation.error, ctx);

    let newState = bumpVersion({
        ...state,
        restState: {
            status: "RUNNING",
            startedAt: ctx.timestamp,
            durationSeconds: duration,
        },
    });
    ctx.effects.push({ type: "START_REST_TIMER", durationSeconds: duration });
    createEvent(newState, "REST_STARTED", { durationSeconds: duration }, ctx);
    return succeed(newState, ctx);
}

function handleSkipRest(state: WorkoutState, ctx: ReduceContext): CommandResult {
    const activeCheck = requireActive(state, ctx);
    if (activeCheck) return activeCheck;

    let newState = bumpVersion({
        ...state,
        restState: { status: "IDLE" },
    });
    ctx.effects.push({ type: "STOP_REST_TIMER" });
    createEvent(newState, "REST_SKIPPED", {}, ctx);
    return succeed(newState, ctx);
}

function handleChangeRest(state: WorkoutState, durationSeconds: number, ctx: ReduceContext): CommandResult {
    const durationValidation = validateRestDuration(durationSeconds);
    if (!durationValidation.valid) return fail(state, durationValidation.error, ctx);

    let newState = bumpVersion({ ...state, defaultRestSeconds: durationSeconds });
    return succeed(newState, ctx);
}

function handleNextExercise(state: WorkoutState, ctx: ReduceContext): CommandResult {
    const activeCheck = requireActive(state, ctx);
    if (activeCheck) return activeCheck;

    if (state.currentExerciseIndex + 1 >= state.exercises.length) {
        return fail(state, createError("INVALID_COMMAND", "No next exercise available"), ctx);
    }

    let newState = saveUndoSnapshot(state);
    const currentExercise = getCurrentExercise(state);
    if (currentExercise && currentExercise.status === "IN_PROGRESS") {
        const updatedExercises = newState.exercises.map((ex, i) => {
            if (i !== state.currentExerciseIndex) return ex;
            return {
                ...ex,
                status: "COMPLETED" as const,
                sets: ex.sets.map((s) =>
                    s.status === "PENDING" ? { ...s, status: "SKIPPED" as const } : s,
                ),
            };
        });
        newState = { ...newState, exercises: updatedExercises };
        createEvent(newState, "EXERCISE_COMPLETED", { exerciseId: currentExercise.exerciseId }, ctx);
    }

    const nextIndex = state.currentExerciseIndex + 1;
    const nextExercises = newState.exercises.map((ex, i) =>
        i === nextIndex ? { ...ex, status: "IN_PROGRESS" as const } : ex,
    );
    newState = {
        ...newState,
        exercises: nextExercises,
        currentExerciseIndex: nextIndex,
        currentSetIndex: 0,
    };
    newState = bumpVersion(newState);
    return succeed(newState, ctx);
}

function firstPendingSetIndex(exercise: { sets: Array<{ status: string }> }): number {
    const index = exercise.sets.findIndex((set) => set.status === "PENDING");
    return index >= 0 ? index : 0;
}

function handlePreviousExercise(state: WorkoutState, ctx: ReduceContext): CommandResult {
    const activeCheck = requireActive(state, ctx);
    if (activeCheck) return activeCheck;

    if (state.currentExerciseIndex <= 0) {
        return fail(state, createError("INVALID_COMMAND", "No previous exercise available"), ctx);
    }

    let newState = saveUndoSnapshot(state);
    const previousIndex = state.currentExerciseIndex - 1;
    const previous = newState.exercises[previousIndex];
    if (!previous) {
        return fail(state, createError("EXERCISE_NOT_FOUND", "Previous exercise not found"), ctx);
    }

    const reopened = {
        ...previous,
        status: "IN_PROGRESS" as const,
        sets: previous.sets.map((set) =>
            set.status === "SKIPPED" ? { ...set, status: "PENDING" as const } : set,
        ),
    };
    const exercises = newState.exercises.map((ex, i) => (i === previousIndex ? reopened : ex));
    newState = {
        ...newState,
        exercises,
        currentExerciseIndex: previousIndex,
        currentSetIndex: firstPendingSetIndex(reopened),
    };
    newState = bumpVersion(newState);
    createEvent(newState, "EXERCISE_RESUMED", { exerciseId: previous.exerciseId }, ctx);
    return succeed(newState, ctx);
}

function handleEndWorkout(state: WorkoutState, ctx: ReduceContext): CommandResult {
    if (state.status !== "ACTIVE" && state.status !== "PAUSED") {
        return fail(
            state,
            createError("INVALID_STATE_TRANSITION", `Cannot end workout from status ${state.status}`),
            ctx,
        );
    }

    let newState = bumpVersion({
        ...state,
        status: "COMPLETED",
        endedAt: ctx.timestamp,
        restState: { status: "IDLE" },
    });
    ctx.effects.push({ type: "STOP_REST_TIMER" });
    createEvent(newState, "WORKOUT_COMPLETED", {}, ctx);
    return succeed(newState, ctx);
}

function handleCancelWorkout(state: WorkoutState, ctx: ReduceContext): CommandResult {
    if (state.status !== "ACTIVE" && state.status !== "PAUSED") {
        return fail(
            state,
            createError("INVALID_STATE_TRANSITION", `Cannot cancel workout from status ${state.status}`),
            ctx,
        );
    }

    let newState = bumpVersion({
        ...state,
        status: "CANCELLED",
        endedAt: ctx.timestamp,
        restState: { status: "IDLE" },
    });
    ctx.effects.push({ type: "STOP_REST_TIMER" });
    createEvent(newState, "WORKOUT_CANCELLED", {}, ctx);
    return succeed(newState, ctx);
}

export interface ApplyCommandOptions {
    timestamp?: string;
}

export function applyCommand(
    state: WorkoutState,
    command: WorkoutCommand,
    options: ApplyCommandOptions = {},
): CommandResult {
    const ctx: ReduceContext = {
        timestamp: options.timestamp ?? new Date().toISOString(),
        events: [],
        effects: [],
        recommendations: [],
    };

    const idempotent = checkIdempotency(state, command, ctx);
    if (idempotent) return idempotent;

    let result: CommandResult;

    switch (command.type) {
        case "START_WORKOUT":
            result = handleStartWorkout(state, ctx);
            break;
        case "PAUSE_WORKOUT":
            result = handlePauseWorkout(state, ctx);
            break;
        case "RESUME_WORKOUT":
            result = handleResumeWorkout(state, ctx);
            break;
        case "COMPLETE_SET":
            result = handleCompleteSet(state, command.weightKg, command.reps, command.source, ctx);
            break;
        case "EDIT_SET":
            result = handleEditSet(state, command.setId, command.weightKg, command.reps, ctx);
            break;
        case "UNDO":
            result = handleUndo(state, ctx);
            break;
        case "SKIP_SET":
            result = handleSkipSet(state, ctx);
            break;
        case "SKIP_EXERCISE":
            result = handleSkipExercise(state, ctx);
            break;
        case "CHANGE_WEIGHT":
            result = handleChangeWeight(state, command.weightKg, ctx);
            break;
        case "CHANGE_REPS":
            result = handleChangeReps(state, command.reps, ctx);
            break;
        case "START_REST":
            result = handleStartRest(state, command.durationSeconds, ctx);
            break;
        case "SKIP_REST":
            result = handleSkipRest(state, ctx);
            break;
        case "CHANGE_REST":
            result = handleChangeRest(state, command.durationSeconds, ctx);
            break;
        case "NEXT_EXERCISE":
            result = handleNextExercise(state, ctx);
            break;
        case "PREVIOUS_EXERCISE":
            result = handlePreviousExercise(state, ctx);
            break;
        case "END_WORKOUT":
            result = handleEndWorkout(state, ctx);
            break;
        case "CANCEL_WORKOUT":
            result = handleCancelWorkout(state, ctx);
            break;
        default: {
            const _exhaustive: never = command;
            result = fail(state, createError("INVALID_COMMAND", `Unknown command type`), ctx);
            void _exhaustive;
        }
    }

    if (result.success && command.commandId) {
        result = { ...result, state: markCommandProcessed(result.state, command.commandId) };
    }

    return result;
}

/** Alias matching the spec's `workoutEngine.reduce` pattern */
export const workoutEngine = { reduce: applyCommand };
