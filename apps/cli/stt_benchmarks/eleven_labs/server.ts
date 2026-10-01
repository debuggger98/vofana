import "dotenv/config";
import { AudioFormat, ElevenLabsClient, RealtimeEvents } from "@elevenlabs/elevenlabs-js";
// @ts-ignore
import AudioRecorder from "node-audiorecorder";

// Initialize the client (automatically reads ELEVENLABS_API_KEY from environment)
const elevenlabs = new ElevenLabsClient();

async function main() {
  console.log("⚡ Connecting to ElevenLabs Realtime STT...");

  // 1. Pass audioFormat instead of url
  const connection = await elevenlabs.speechToText.realtime.connect({
    modelId: "scribe_v2_realtime",
    audioFormat: AudioFormat.PCM_16000, // Required format for standard microphone PCM stream
    sampleRate: 16000,
  });

  // 2. Set up event listeners
  connection.on(RealtimeEvents.SESSION_STARTED, (data) => {
    console.log("✅ Session started:", data);
    console.log("🎤 Recording active! Speak into your microphone... (Press Ctrl+C to stop)\n");
    
    // Start capturing microphone audio when session is ready
    startMicStream(connection);
  });

  connection.on(RealtimeEvents.PARTIAL_TRANSCRIPT, (transcript: any) => {
    if (transcript.text) {
      process.stdout.write(`\r💬 Live Partial: ${transcript.text}`);
    }
  });

  connection.on(RealtimeEvents.COMMITTED_TRANSCRIPT, (transcript: any) => {
    process.stdout.write("\r"); // Clear line
    console.log(`✅ Final Transcript: ${transcript.text}`);
  });

  connection.on(RealtimeEvents.COMMITTED_TRANSCRIPT_WITH_TIMESTAMPS, (transcript: any) => {
    // Enable by adding includeTimestamps: true to connect options if needed
    console.log("\n⏱️ Timestamps:", JSON.stringify(transcript.words, null, 2));
  });

  connection.on(RealtimeEvents.ERROR, (error) => {
    console.error("\n❌ ElevenLabs STT Error:", error);
  });

  connection.on(RealtimeEvents.CLOSE, () => {
    console.log("\n Connection closed.");
  });
}

function startMicStream(connection: any) {
  // 3. Configure AudioRecorder for 16kHz, 16-bit Mono RAW PCM
  const recorderOptions = {
    program: "rec",             // 'rec' | 'sox' | 'arecord'
    bits: 16,
    channels: 1,
    rate: 16000,
    type: "raw",                // Headerless audio bytes
    silence: 0,
    keepSilence: true,
  };

  const audioRecorder = new AudioRecorder(recorderOptions, console);

  // Catch missing binary errors (e.g. if 'rec' is not in PATH)
  audioRecorder.on("error", (err: any) => {
    if (err.code === "ENOENT") {
      console.error(
        `\n❌ Missing binary '${err.path}'. Install 'sox' (sudo apt install sox) or switch program to 'arecord'.`
      );
    } else {
      console.error("\n❌ AudioRecorder Error:", err);
    }
    process.exit(1);
  });

  audioRecorder.start();
  const stream = audioRecorder.stream();

  // 4. Send Base64-encoded PCM audio chunks to ElevenLabs
  stream.on("data", (chunk: Buffer) => {
    connection.send({
        audioBase64: chunk.toString("base64"),
    });
  });

  stream.on("error", (err: any) => {
    console.error("Audio Stream Error:", err);
  });

  // Gracefully handle shutdown on Ctrl+C
  process.on("SIGINT", async () => {
    console.log("\n🛑 Stopping recording and closing session...");
    audioRecorder.stop();
    await connection.close();
    process.exit(0);
  });
}

main().catch(console.error);