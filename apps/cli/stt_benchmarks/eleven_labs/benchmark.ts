import "dotenv/config";
import {
  AudioFormat,
  CommitStrategy,
  ElevenLabsClient,
  RealtimeEvents,
} from "@elevenlabs/elevenlabs-js";
// @ts-ignore
import AudioRecorder from "node-audiorecorder";

interface PendingWord {
  word: string;
  receivedTimeMs: number;
}

interface WordBenchmark {
  word: string;
  partialWord: string;
  spokenOffsetSec: number;
  receivedTimeMs: number;
  latencyMs: number;
}

const SAMPLE_RATE = 16000;
const CHANNELS = 1;

const elevenlabs = new ElevenLabsClient();

let streamStartTimeMs = 0;
/** Words first seen in PARTIAL_TRANSCRIPT for the current uncommitted segment. */
let pendingFirstSeen: PendingWord[] = [];
let previousPartialWords: string[] = [];
const latencyLog: WordBenchmark[] = [];

function tokenize(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

function onPartialTranscript(text: string): void {
  const words = tokenize(text);
  if (words.length === 0) return;

  // Newly appended tokens only — revisions of earlier tokens are ignored.
  for (let i = previousPartialWords.length; i < words.length; i++) {
    const word = words[i];
    const receivedTimeMs = Date.now();
    pendingFirstSeen.push({ word, receivedTimeMs });

    const wallSec = ((receivedTimeMs - streamStartTimeMs) / 1000).toFixed(2);
    process.stdout.write("\r");
    console.log(
      `👁️  First partial: "${word.padEnd(16, " ")}" | wall ${wallSec}s | pending #${pendingFirstSeen.length}`
    );
  }

  previousPartialWords = words;

  const elapsed = ((Date.now() - streamStartTimeMs) / 1000).toFixed(1);
  process.stdout.write(`\r💬 [Wall ${elapsed}s] Partial: "${text}"`);
}

function onCommittedWithTimestamps(event: {
  text?: string;
  words?: Array<{ text?: string; start?: number; type?: string }>;
}): void {
  const receiveCommitMs = Date.now();
  const timedWords = (event.words ?? []).filter((w) => {
    const text = (w.text ?? "").trim();
    if (!text) return false;
    // SDK may omit type; skip pure spacing tokens when type is present.
    if (w.type === "spacing" || w.type === "audio_event") return false;
    return true;
  });

  const n = Math.min(pendingFirstSeen.length, timedWords.length);
  if (pendingFirstSeen.length !== timedWords.length) {
    console.warn(
      `\n⚠️  Partial first-seen count (${pendingFirstSeen.length}) != committed words (${timedWords.length}); pairing first ${n}.`
    );
  }

  process.stdout.write("\r");
  for (let i = 0; i < n; i++) {
    const pending = pendingFirstSeen[i];
    const timed = timedWords[i];
    const wordText = (timed.text ?? "").trim();
    const spokenOffsetSec = Number(timed.start ?? 0);
    const spokenTimeMs = streamStartTimeMs + Math.round(spokenOffsetSec * 1000);
    // True per-word latency: first partial appearance − ElevenLabs spoken start.
    const latencyMs = Math.max(0, pending.receivedTimeMs - spokenTimeMs);

    latencyLog.push({
      word: wordText,
      partialWord: pending.word,
      spokenOffsetSec,
      receivedTimeMs: pending.receivedTimeMs,
      latencyMs,
    });

    console.log(
      `⏱️  Latency: ${latencyMs.toString().padStart(4, " ")} ms | ` +
        `Word: "${wordText.padEnd(16, " ")}" | ` +
        `Spoken: ${spokenOffsetSec.toFixed(2)}s | ` +
        `First partial wall: ${((pending.receivedTimeMs - streamStartTimeMs) / 1000).toFixed(2)}s`
    );
  }

  // Any leftover pending without timestamps still useful as sighting-only.
  if (n === 0 && pendingFirstSeen.length > 0) {
    console.warn(
      `⚠️  Commit had no word timestamps; ${pendingFirstSeen.length} partial first-seen words dropped from latency.`
    );
  }

  console.log(
    `✅ [Committed @ ${((receiveCommitMs - streamStartTimeMs) / 1000).toFixed(2)}s]: "${event.text ?? ""}"`
  );

  pendingFirstSeen = [];
  previousPartialWords = [];
}

async function main() {
  console.log("⚡ Connecting to ElevenLabs Scribe v2 Realtime STT...");
  console.log(
    "📌 Partial first-word latency = first PARTIAL appearance time − word.start from commit timestamps.\n"
  );

  const connection = await elevenlabs.speechToText.realtime.connect({
    modelId: "scribe_v2_realtime",
    audioFormat: AudioFormat.PCM_16000,
    sampleRate: SAMPLE_RATE,
    includeTimestamps: true,
    // Commit on silence so word.start arrives throughout the session, not only after ~36s.
    commitStrategy: CommitStrategy.VAD,
  });

  connection.on(RealtimeEvents.SESSION_STARTED, (data) => {
    console.log("✅ WebSocket Session Established:", data);
    console.log("\n==========================================================================");
    console.log("🗣️  READ ALOUD TO BENCHMARK LATENCY:");
    console.log('"Hi, can you hear me? Is this live? Okay, I need to look at the latency now.');
    console.log(" But, you know, Arch Linux is actually difficult to understand.");
    console.log(" And when you are actually working, like, concurrently, you see there are");
    console.log(' a lot of things that we need to understand."');
    console.log("==========================================================================\n");

    startMicStream(connection);
  });

  connection.on(RealtimeEvents.PARTIAL_TRANSCRIPT, (data) => {
    console.log("PARTIAL_TRANSCRIPT", data);
    if (data?.text) onPartialTranscript(data.text);
  });

  connection.on(RealtimeEvents.COMMITTED_TRANSCRIPT, (data) => {
    // Prefer timestamped commit for latency; this fires first without words.
    process.stdout.write("\r");
    console.log("COMMITTED_TRANSCRIPT", data);
    console.log(`📝 [Committed text]: "${data?.text || ""}"`);
  });

  connection.on(RealtimeEvents.COMMITTED_TRANSCRIPT_WITH_TIMESTAMPS, (event) => {
    console.log("COMMITTED_TRANSCRIPT_WITH_TIMESTAMPS", event);
    onCommittedWithTimestamps(event);
  });

  connection.on(RealtimeEvents.ERROR, (error) => {
    console.error("\n❌ ElevenLabs Realtime STT Error:", error);
  });

  connection.on(RealtimeEvents.CLOSE, () => {
    printBenchmarkSummary();
  });
}

function startMicStream(connection: any) {
  const recorderOptions = {
    program: "rec",
    bits: 16,
    channels: CHANNELS,
    rate: SAMPLE_RATE,
    type: "raw",
    silence: 0,
    keepSilence: true,
  };

  const audioRecorder = new AudioRecorder(recorderOptions, console);

  audioRecorder.on("error", (err: any) => {
    if (err.code === "ENOENT") {
      console.error(
        `\n❌ Missing audio binary '${err.path}'. Install 'sox' (sudo apt install sox) or switch program to 'arecord'.`
      );
    } else {
      console.error("\n❌ AudioRecorder Error:", err);
    }
    process.exit(1);
  });

  streamStartTimeMs = Date.now();
  audioRecorder.start();
  const stream = audioRecorder.stream();

  stream.on("data", (chunk: Buffer) => {
    connection.send({
      audioBase64: chunk.toString("base64"),
    });
  });

  process.on("SIGINT", async () => {
    console.log("\n\n🛑 Stopping recording and finalizing latency report...\n");
    audioRecorder.stop();
    await connection.close();
    printBenchmarkSummary();
    process.exit(0);
  });
}

function printBenchmarkSummary() {
  if (latencyLog.length === 0) {
    console.log(
      "⚠️ No latency samples. Need partials + a commit with timestamps (pause so VAD/manual/auto commit can fire)."
    );
    return;
  }

  const latencies = latencyLog.map((l) => l.latencyMs).sort((a, b) => a - b);
  const sum = latencies.reduce((acc, v) => acc + v, 0);
  const avg = Math.round(sum / latencies.length);
  const min = latencies[0];
  const max = latencies[latencies.length - 1];

  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p90 = latencies[Math.floor(latencies.length * 0.9)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];

  console.log("\n==========================================================================");
  console.log("📊 ELEVENLABS PARTIAL FIRST-WORD LATENCY SUMMARY");
  console.log("==========================================================================");
  console.log(
    "Latency = wall time of first PARTIAL_TRANSCRIPT appearance − ElevenLabs word.start"
  );
  console.log("(spoken time from commit timestamps; receive time from live partials)\n");

  console.table(
    latencyLog.map((item) => ({
      Word: item.word,
      Partial: item.partialWord,
      "Spoken (s)": `${item.spokenOffsetSec.toFixed(2)}s`,
      "Latency (ms)": `${item.latencyMs} ms`,
    }))
  );

  console.log("--------------------------------------------------------------------------");
  console.log(` Evaluated Words      : ${latencies.length}`);
  console.log(` Minimum Latency      : ${min} ms`);
  console.log(` Average (Mean)       : ${avg} ms`);
  console.log(` P50 (Median) Latency : ${p50} ms`);
  console.log(` P90 Latency          : ${p90} ms`);
  console.log(` P95 Latency          : ${p95} ms`);
  console.log(` Maximum Latency      : ${max} ms`);
  console.log("==========================================================================\n");
}

main().catch(console.error);
