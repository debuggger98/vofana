// @ts-ignore (node-audiorecorder may lack built-in typings depending on version)
import AudioRecorder from 'node-audiorecorder';
import dotenv from 'dotenv';
dotenv.config();
// Configuration for 16kHz, 16-bit signed integer, Mono raw PCM
const recorderOptions = {
  program: 'rec',             // 'rec' | 'sox' | 'arecord'
  bits: 16,
  channels: 1,
  rate: 16000,
  type: 'raw',                // Send raw headerless PCM bytes
  silence: 0,
  keepSilence: true,
};

const audioRecorder = new AudioRecorder(recorderOptions, console);

console.log('🎤 Initializing Microphone Test...');
console.log('🔊 Speak into your mic! (Press Ctrl+C to stop)\n');

// Start recording and get the readable stream
audioRecorder.start();
const stream = audioRecorder.stream();

let totalBytesReceived = 0;

stream.on('data', (chunk: Buffer) => {
  totalBytesReceived += chunk.length;

  // Calculate approximate Root Mean Square (RMS) volume from 16-bit samples
  let sum = 0;
  const sampleCount = chunk.length / 2;

  for (let i = 0; i < chunk.length; i += 2) {
    const sample = chunk.readInt16LE(i);
    sum += sample * sample;
  }

  const rms = Math.sqrt(sum / sampleCount);
  const volumeMeter = '█'.repeat(Math.min(Math.floor(rms / 500), 30));

  process.stdout.write(
    `\rRecording | Total: ${(totalBytesReceived / 1024).toFixed(1)} KB | Vol: [${volumeMeter.padEnd(30, ' ')}]`
  );
});

stream.on('error', (err: any) => {
  console.error('\n❌ Audio Stream Error:', err);
});

process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping microphone recording...');
  audioRecorder.stop();
  process.exit(0);
});