import WebSocket from "ws";
// @ts-ignore (node-audiorecorder may lack built-in typings depending on version)
import AudioRecorder from "node-audiorecorder";
import dotenv from "dotenv";
dotenv.config();
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || "YOUR_SARVAM_API_KEY";

if (!SARVAM_API_KEY || SARVAM_API_KEY === "YOUR_SARVAM_API_KEY") {
    console.error("❌ Please set your SARVAM_API_KEY environment variable.");
    process.exit(1);
}

// 1. Build Sarvam Realtime WebSocket Connection URL
const params = new URLSearchParams({
    language_code: "hi-IN", // Options: 'hi-IN', 'en-IN', 'auto', etc.
    model: "saaras:v3-realtime",
    sample_rate: "16000", // Matches node-audiorecorder rate
    encoding: "linear16", // Raw 16-bit PCM
    stream_type: "balanced", // 'fast' | 'balanced'
    endpointing: "vad", // Auto-detect speech turns
});

const wsUrl = `wss://api.sarvam.ai/speech-to-text-realtime/ws?${params.toString()}`;

const ws = new WebSocket(wsUrl, {
    headers: {
        "api-subscription-key": SARVAM_API_KEY,
    },
});

let audioRecorder: any = null;

// 2. Open WebSocket
ws.on("open", () => {
    console.log("✅ Connected to Sarvam WS Server.");
    console.log("🎤 Audio recording active. Speak into your mic...\n");

    // Configure AudioRecorder for 16kHz Mono RAW PCM
    const recorderOptions = {
        program: "rec", // 'rec' | 'sox' | 'arecord'
        bits: 16,
        channels: 1,
        rate: 16000,
        type: "raw", // Headerless audio
        silence: 0,
        keepSilence: true,
    };

    audioRecorder = new AudioRecorder(recorderOptions, console);
    audioRecorder.start();

    const audioStream = audioRecorder.stream();

    // Pipe audio buffers into WebSocket
    audioStream.on("data", (chunk: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
            const payload = {
                event: "audio_input",
                audio: chunk.toString("base64"),
            };
            ws.send(JSON.stringify(payload));
        }
    });

    audioStream.on("error", (err: any) => {
        console.error("Audio Recorder Error:", err);
    });
});

// 3. Handle incoming WebSocket responses
ws.on("message", (data: WebSocket.RawData) => {
    try {
        const response = JSON.parse(data.toString());

        switch (response.event) {
            case "session.begin":
                console.log(
                    `[SESSION STARTED] Request ID: ${response.request_id}`,
                );
                break;

            case "transcript.partial":
                // Overwrite live line on terminal
                process.stdout.write(`\r💬 Live: ${response.transcript}`);
                break;

            case "transcript.final":
                process.stdout.write("\r"); // Clear line
                console.log(`✅ Final: ${response.transcript}`);
                break;

            case "error":
                console.error("\n❌ Sarvam API Error:", response);
                break;

            default:
                break;
        }
    } catch (err) {
        console.error("Error parsing response frame:", err);
    }
});

ws.on("error", (error) => {
    console.error("WebSocket Error:", error.message);
});

ws.on("close", (code, reason) => {
    console.log(`\nConnection closed [${code}]: ${reason.toString()}`);
    if (audioRecorder) audioRecorder.stop();
});

// Handle graceful termination
process.on("SIGINT", () => {
    console.log("\nStopping recording and closing session...");
    if (audioRecorder) audioRecorder.stop();

    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: "session.end" }));
        setTimeout(() => ws.close(), 300);
    } else {
        process.exit(0);
    }
});
