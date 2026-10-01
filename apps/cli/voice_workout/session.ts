import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
    AudioFormat,
    CommitStrategy,
    ElevenLabsClient,
    RealtimeConnection,
    RealtimeEvents,
} from "@elevenlabs/elevenlabs-js";
// @ts-ignore
import AudioRecorder from "node-audiorecorder";
import {
    parseVoiceCommand,
    workoutContextFromState,
    type ParseResult,
    type WorkoutContext,
} from "../../../packages/voice-parser/src/index.ts";
import {
    applyCommand,
    createWorkout,
    describeNextAction,
    answerQuery,
    getCurrentExercise,
    getCurrentSet,
    type CommandResult,
    type WorkoutState,
} from "../../../packages/workout-engine/src/index.ts";
import { INTENTS, UTTERANCES } from "../constants.ts";

const SAMPLE_RATE = 16000;
const CHANNELS = 1;

function coerceTranscript(value: string): string | undefined {
    const trimmed = value.trim();
    if (
        !trimmed ||
        trimmed.toLowerCase() === "undefined" ||
        trimmed.toLowerCase() === "null"
    ) {
        return undefined;
    }
    return trimmed;
}

function extractSttText(payload: unknown): string | undefined {
    if (typeof payload === "string") {
        return coerceTranscript(payload);
    }
    if (payload && typeof payload === "object" && "text" in payload) {
        const text = (payload as { text?: unknown }).text;
        if (typeof text === "string") {
            return coerceTranscript(text);
        }
    }
    return undefined;
}

function createDemoWorkout(): WorkoutState {
    return createWorkout({
        sessionId: "cli-session",
        userId: "cli-user",
        workoutId: "cli-demo",
        defaultRestSeconds: 90,
        exercises: [
            {
                exerciseId: "bench_press",
                name: "Bench Press",
                order: 0,
                target: { sets: 3, reps: { min: 8, max: 10 }, weightKg: 60 },
            },
            {
                exerciseId: "incline_dumbbell_press",
                name: "Incline Dumbbell Press",
                order: 1,
                target: { sets: 3, reps: { min: 8, max: 10 }, weightKg: 22.5 },
            },
            {
                exerciseId: "squat",
                name: "Squat",
                order: 2,
                target: { sets: 3, reps: { min: 5, max: 5 }, weightKg: 100 },
            },
        ],
    });
}

function toWorkoutContext(state: WorkoutState): WorkoutContext {
    return workoutContextFromState(state);
}

function formatKg(value?: number): string {
    return value === undefined ? "—" : `${value} kg`;
}

function printState(state: WorkoutState): void {
    // console.log(JSON.stringify(state, null, 2));
    const exercise = getCurrentExercise(state);
    const set = getCurrentSet(state);
    const log = state.completedSets
        .map((record) => {
            const name =
                state.exercises.find(
                    (item) => item.exerciseId === record.exerciseId,
                )?.name ?? record.exerciseId;
            return `${name} ${record.weightKg}×${record.reps}`;
        })
        .join("  |  ");

    console.log("\n────────────────────────────────────────");
    console.log(`status     ${state.status}  (v${state.version})`);
    console.log(`position   ${describeNextAction(state)}`);
    if (exercise && set) {
        console.log(
            `current    ${exercise.name}  set ${set.setNumber}  ${set.status}  planned ${formatKg(set.plannedWeightKg)} × ${set.plannedReps ?? "?"}  actual ${formatKg(set.actualWeightKg)} × ${set.actualReps ?? "—"}`,
        );
    }
    console.log(
        `rest       ${state.restState.status}${state.restState.durationSeconds ? ` ${state.restState.durationSeconds}s` : ""}`,
    );
    console.log(`log        ${log || "(empty)"}`);
    console.log("────────────────────────────────────────\n");
}

function printParse(parseResult: ParseResult): void {
    console.log(
        `parser     ${parseResult.status}  confidence ${parseResult.confidence.toFixed(2)}`,
    );
    console.log(`normalized ${parseResult.normalizedTranscript}`);
    if (parseResult.interpretation?.intent) {
        console.log(`intent     ${parseResult.interpretation.intent}`);
    }
    if (parseResult.command) {
        console.log(`command    ${JSON.stringify(parseResult.command)}`);
    }
    if (parseResult.candidates?.length) {
        console.log(`candidates ${JSON.stringify(parseResult.candidates)}`);
    }
    if (parseResult.error) {
        console.log(
            `parse err  ${parseResult.error.code}: ${parseResult.error.message}`,
        );
    }
}

function printEngine(result: CommandResult): void {
    if (!result.success) {
        console.log(
            `engine     FAIL  ${result.error?.code}: ${result.error?.message}`,
        );
        return;
    }
    console.log(`engine     OK`);
    if (result.events.length > 0) {
        console.log(
            `events     ${result.events.map((event) => event.type).join(", ")}`,
        );
    }
    if (result.effects.length > 0) {
        console.log(`effects    ${JSON.stringify(result.effects)}`);
    }
    if (result.recommendations.length > 0) {
        console.log(`recs       ${JSON.stringify(result.recommendations)}`);
    }
}

class WorkoutSession {
    state: WorkoutState;

    constructor() {
        this.state = createDemoWorkout();
        const started = applyCommand(this.state, { type: "START_WORKOUT" });
        if (!started.success) {
            throw new Error(
                started.error?.message ?? "Failed to start demo workout",
            );
        }
        this.state = started.state;
    }

    handleTranscript(transcript: string): void {
        const trimmed = coerceTranscript(transcript);
        if (!trimmed) return;

        console.log(`\n🎤 transcript  "${trimmed}"`);

        const parseStarted = performance.now();
        const parseResult = parseVoiceCommand({
            transcript: trimmed,
            context: toWorkoutContext(this.state),
        });
        const parseMs = performance.now() - parseStarted;

        printParse(parseResult);
        console.log(`timing     parser ${parseMs.toFixed(1)} ms`);

        if (parseResult.status === "QUERY" && parseResult.interpretation?.intent) {
            console.log(`answer     ${answerQuery(this.state, parseResult.interpretation.intent)}`);
            printState(this.state);
            return;
        }

        if (parseResult.status !== "PARSED" || !parseResult.command) {
            printState(this.state);
            return;
        }

        const engineStarted = performance.now();
        const engineResult = applyCommand(this.state, parseResult.command);
        const engineMs = performance.now() - engineStarted;

        printEngine(engineResult);
        console.log(`timing     engine ${engineMs.toFixed(1)} ms`);

        if (engineResult.success) {
            this.state = engineResult.state;
        }
        printState(this.state);
    }
}

function printIntro(mode: "voice" | "text"): void {
    console.log("\nVofana voice workout loop");
    console.log(
        "Mic → ElevenLabs STT → voice-parser → workout-engine → terminal\n",
    );
    console.log(
        "Demo workout: Bench Press (3×8–10 @ 60kg) → Incline DB Press (3×8–10 @ 22.5kg) → Squat (3×5 @ 100kg)",
    );
    console.log("Session starts ACTIVE so you can log sets immediately.\n");
    console.log("Intents:", INTENTS.join(", "));
    console.log("Try:", UTTERANCES.join("  |  "));
    console.log(
        "Also: what exercise am I on, which set am I on, what weight did I use, pause / hold on, I meant 40, end workout\n",
    );
    if (mode === "text") {
        console.log(
            "Text mode. Type a command and press Enter. Type quit to exit.\n",
        );
    } else {
        console.log(
            "Voice mode. Pause after each command so VAD can commit. Ctrl+C to stop.\n",
        );
    }
}

function isQuit(line: string): boolean {
    const value = line.trim().toLowerCase();
    return value === "quit" || value === "exit";
}

async function runTextMode(session: WorkoutSession): Promise<void> {
    printIntro("text");
    printState(session.state);

    const rl = createInterface({ input, output });
    try {
        if (!input.isTTY) {
            for await (const line of rl) {
                if (isQuit(line)) break;
                session.handleTranscript(line);
            }
            return;
        }

        while (true) {
            const line = await rl.question("> ");
            if (isQuit(line)) break;
            session.handleTranscript(line);
        }
    } finally {
        rl.close();
    }
}

async function runVoiceMode(session: WorkoutSession): Promise<void> {
    printIntro("voice");
    printState(session.state);

    const elevenlabs = new ElevenLabsClient();
    console.log("Connecting to ElevenLabs Scribe v2 realtime STT...");

    const connection = await elevenlabs.speechToText.realtime.connect({
        modelId: "scribe_v2_realtime",
        audioFormat: AudioFormat.PCM_16000,
        sampleRate: SAMPLE_RATE,
        commitStrategy: CommitStrategy.VAD,
        languageCode: "en",
    });

    connection.on(RealtimeEvents.SESSION_STARTED, () => {
        console.log("Session started. Speak a command.\n");
        startMicStream(connection);
    });

    connection.on(
        RealtimeEvents.PARTIAL_TRANSCRIPT,
        (transcript: { text?: string }) => {
            if (transcript.text) {
                process.stdout.write(`\r💬 ${transcript.text}`);
            }
        },
    );

    connection.on(
        RealtimeEvents.COMMITTED_TRANSCRIPT,
        (transcript: unknown) => {
            process.stdout.write("\r");
            const text = extractSttText(transcript);
            if (!text) return;
            session.handleTranscript(text);
        },
    );

    connection.on(RealtimeEvents.ERROR, (error: unknown) => {
        console.error("\nElevenLabs STT error:", error);
    });

    connection.on(RealtimeEvents.CLOSE, () => {
        console.log("\nSTT connection closed.");
    });
}

function startMicStream(connection: RealtimeConnection): void {
    const audioRecorder = new AudioRecorder(
        {
            program: "rec",
            bits: 16,
            channels: CHANNELS,
            rate: SAMPLE_RATE,
            type: "raw",
            silence: 0,
            keepSilence: true,
        },
        console,
    );

    audioRecorder.on("error", (err: { code?: string; path?: string }) => {
        if (err.code === "ENOENT") {
            console.error(
                `\nMissing binary '${err.path}'. Install sox (sudo pacman -S sox) or switch program to arecord.`,
            );
        } else {
            console.error("\nAudioRecorder error:", err);
        }
        process.exit(1);
    });

    audioRecorder.start();
    const stream = audioRecorder.stream();

    stream.on("data", (chunk: Buffer) => {
        connection.send({ audioBase64: chunk.toString("base64") });
    });

    stream.on("error", (err: unknown) => {
        console.error("Audio stream error:", err);
    });

    process.on("SIGINT", async () => {
        console.log("\nStopping session...");
        audioRecorder.stop();
        await connection.close();
        process.exit(0);
    });
}

async function main(): Promise<void> {
    const textMode = process.argv.includes("--text");
    const session = new WorkoutSession();

    if (textMode) {
        await runTextMode(session);
        return;
    }

    await runVoiceMode(session);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
