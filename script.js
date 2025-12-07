// ===============================
// CONFIG
// ===============================
const FPS = 60;
const FRAME_TIME = 1 / FPS;
const LOOP = true;

// ===============================
// DOM
// ===============================
const screen = document.getElementById("screen");
const loading = document.getElementById("loading");
const hint = document.getElementById("hint");

// ===============================
// STATE
// ===============================
let frames = [];
let frameIndex = 0;
let videoTime = 0;
let lastTimestamp = null;

let audioEnabled = false;
let duration = 0;

// WebAudio
let audioCtx;
let audioBuffer;
let audioSource = null;

// ===============================
// LOAD ASCII FRAMES
// ===============================
fetch("ascii_frames.json", { cache: "no-store" })
  .then(r => r.json())
  .then(data => {
    frames = data;
    duration = frames.length * FRAME_TIME;

    loading.style.display = "none";
    screen.style.display = "block";
    hint.style.display = "block";

    requestAnimationFrame(loop);
  });

// ===============================
// LOAD AUDIO (WebAudio)
// ===============================
async function loadAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  const response = await fetch("audio.mp3", { cache: "no-store" });
  const arrayBuffer = await response.arrayBuffer();
  audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  console.log("Audio decoded, duration:", audioBuffer.duration);
}
loadAudio();


// ===============================
// USER INTERACTION → ENABLE AUDIO
// ===============================
async function enableAudio() {
  if (audioEnabled || !audioBuffer) return;

  audioEnabled = true;
  hint.style.display = "none";

  // Resume context if suspended
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  // Stop old source if any
  if (audioSource) {
    audioSource.stop();
  }

  // Create new audio source
  audioSource = audioCtx.createBufferSource();
  audioSource.buffer = audioBuffer;
  audioSource.loop = LOOP;

  // Sync EXACT to video timeline
  const offset = videoTime % audioBuffer.duration;

  audioSource.connect(audioCtx.destination);
  audioSource.start(0, offset);

  console.log("Audio started at offset:", offset.toFixed(3));
}

window.addEventListener("pointerdown", enableAudio, { once: false });
window.addEventListener("keydown", enableAudio, { once: false });


// ===============================
// MAIN FRAME LOOP
// ===============================
function loop(ts) {
  if (!lastTimestamp) lastTimestamp = ts;
  const delta = (ts - lastTimestamp) / 1000;
  lastTimestamp = ts;

  videoTime += delta;

  // Loop video timeline
  if (LOOP && videoTime >= duration) {
    videoTime = 0;
  }

  // Compute frame
  frameIndex = Math.floor(videoTime * FPS);
  if (frameIndex >= frames.length) frameIndex = frames.length - 1;

  // Draw ASCII frame
  screen.textContent = frames[frameIndex];

  // ========================
  // SYNC AUDIO IF PLAYING
  // ========================
  if (audioEnabled && audioSource) {
    const audioPos =
      (audioCtx.currentTime % audioBuffer.duration);

    const drift = Math.abs(audioPos - videoTime);

    if (drift > 0.04) { // > 40ms → correct
      audioSource.stop();

      audioSource = audioCtx.createBufferSource();
      audioSource.buffer = audioBuffer;
      audioSource.loop = LOOP;
      audioSource.connect(audioCtx.destination);

      audioSource.start(0, videoTime % audioBuffer.duration);

      console.log("Corrected drift:", drift.toFixed(3));
    }
  }

  requestAnimationFrame(loop);
}
