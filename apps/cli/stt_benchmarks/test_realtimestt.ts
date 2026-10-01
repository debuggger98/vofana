import WebSocket from 'ws';
import dotenv from 'dotenv';
dotenv.config();
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || 'YOUR_SARVAM_API_KEY';

if (!SARVAM_API_KEY || SARVAM_API_KEY === 'YOUR_SARVAM_API_KEY') {
  console.error('❌ Set SARVAM_API_KEY environment variable before running.');
  process.exit(1);
}

// 1. Test REST API (Translating / Transcribing via REST)
async function testRestApi() {
  console.log('🔍 Testing REST Endpoint authentication...');

  // Create a minimal 1-second silent WAV audio buffer
  const sampleRate = 16000;
  const numSamples = sampleRate; // 1 second
  const pcmData = Buffer.alloc(numSamples * 2); // 16-bit silence (zeros)

  const wavHeader = Buffer.alloc(44);
  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + pcmData.length, 4);
  wavHeader.write('WAVE', 8);
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20); // PCM format
  wavHeader.writeUInt16LE(1, 22); // Mono
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(sampleRate * 2, 28);
  wavHeader.writeUInt16LE(2, 32);
  wavHeader.writeUInt16LE(16, 34);
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(pcmData.length, 40);

  const wavBuffer = Buffer.concat([wavHeader, pcmData]);

  const formData = new FormData();
  formData.append(
    'file',
    new Blob([wavBuffer], { type: 'audio/wav' }),
    'test.wav'
  );
  formData.append('model', 'saaras:v2');

  try {
    const res = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'api-subscription-key': SARVAM_API_KEY,
      },
      body: formData,
    });

    const status = res.status;
    const body = await res.json();

    if (res.ok) {
      console.log('✅ REST API Working! Response:', body);
      return true;
    } else {
      console.error(
        `❌ REST API Failed [Status ${status}]:`,
        JSON.stringify(body, null, 2)
      );
      return false;
    }
  } catch (err: any) {
    console.error('❌ REST Network Error:', err.message);
    return false;
  }
}

// 2. Test Realtime WebSocket Endpoint
function testWebSocketApi() {
  return new Promise((resolve) => {
    console.log('\n🔍 Testing WebSocket Endpoint...');

    const params = new URLSearchParams({
      language_code: 'hi-IN',
      model: 'saaras:v3-realtime',
    });

    const wsUrl = `wss://api.sarvam.ai/speech-to-text-realtime/ws?${params.toString()}`;
    const ws = new WebSocket(wsUrl, {
      headers: {
        'api-subscription-key': SARVAM_API_KEY,
      },
    });

    ws.on('open', () => {
      console.log('⚡ WebSocket Connection Handshake Successful!');
    });

    ws.on('message', (data) => {
      const resp = JSON.parse(data.toString());
      console.log('📩 WS Message Received:', resp);
      if (resp.event === 'session.begin') {
        console.log('✅ Realtime WS Session Ready!');
        ws.send(JSON.stringify({ event: 'session.end' }));
        ws.close();
        resolve(true);
      }
    });

    ws.on('error', (err) => {
      console.error('❌ WS Error:', err.message);
    });

    ws.on('close', (code, reason) => {
      if (code !== 1000) {
        console.error(
          `❌ WS Closed with Error Code [${code}]: ${reason.toString()}`
        );
        resolve(false);
      }
    });
  });
}

async function run() {
  const restOk = await testRestApi();
  const wsOk = await testWebSocketApi();

  console.log('\n--- Diagnostic Results ---');
  console.log(`REST API Status: ${restOk ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`WebSocket Status: ${wsOk ? 'PASS ✅' : 'FAIL ❌'}`);
}

run();