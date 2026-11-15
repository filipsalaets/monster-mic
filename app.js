// ===== Monster Mic – app.js =====
// Sections:
//   1. Settings you can tune
//   2. Voice effects (one small function per voice)
//   3. App state + finding page elements
//   4. Start screen: unlock audio + ask for the microphone
//   5. Recording (hold the button)
//   6. Turning the recording into sound data we can play
//   7. Playback (tap a card)
//   8. Little UI helpers
//   9. Wiring buttons to functions
'use strict';

// ===== 1. Settings you can tune =====
const MAX_SECONDS = 15;     // longest recording
const MIN_SECONDS = 0.4;    // shorter than this was probably a tap, not a hold
// Turn the mic off after each recording. On iPhone a live mic pushes the sound
// to the quiet earpiece speaker; turning it off brings back the loud speaker.
const RELEASE_MIC_AFTER_RECORDING = true;
// Open the page as index.html?test to get a "test clip" button (no microphone needed).
const TEST_MODE = new URLSearchParams(location.search).has('test');


// ===== 2. Voice effects =====
// Every effect function gets:
//   player – a Tone.Player holding your recording
//   out    – where the finished sound should go (a limiter, then the speaker)
// It wires the player through its effects to `out`, and returns the list of
// effect nodes it created, so we can throw them away when the next voice plays.
// Tip: change the numbers here to tune each voice.

function helium(player, out) {
  // Pitch up 8 semitones, same speed. A small window sounds cleaner for high voices.
  const shift = new Tone.PitchShift({ pitch: 8, windowSize: 0.05 });
  player.chain(shift, out);
  return [shift];
}

function monster(player, out) {
  // Pitch down 7 semitones, then a bit of growl (distortion).
  const shift = new Tone.PitchShift({ pitch: -7, windowSize: 0.1 });
  const growl = new Tone.Distortion({ distortion: 0.3, wet: 0.5 });
  player.chain(shift, growl, out);
  return [shift, growl];
}

function robot(player, out) {
  // Ring modulator: the voice's volume is multiplied by a 50 Hz wave,
  // so it swings + and - 50 times a second. That gives the metallic buzz.
  // How: a Gain starting at 0, whose gain knob is "turned" by an oscillator.
  const ring = new Tone.Gain(0);
  const buzz = new Tone.Oscillator(50, 'sine').start();
  buzz.connect(ring.gain);
  const boost = new Tone.Gain(1.8);          // ring modulation makes it quieter; make up for it
  player.chain(ring, boost, out);
  return [ring, buzz, boost];
}

function backwards(player, out) {
  // No effect needed: this voice uses the reversed copy of the recording
  // (see `reversed: true` in the VOICES list below).
  player.connect(out);
  return [];
}

async function caveEcho(player, out) {
  // Echo (repeats every 0.25 s, each repeat a bit quieter) into a big reverb.
  const echo = new Tone.FeedbackDelay({ delayTime: 0.25, feedback: 0.45, wet: 0.4 });
  const reverb = new Tone.Reverb({ decay: 4, wet: 0.45 });
  await reverb.ready;   // the reverb computes its "room sound" first; wait for it
  player.chain(echo, reverb, out);
  return [echo, reverb];
}

function alien(player, out) {
  // Slightly higher voice plus a fast wobble (vibrato).
  const shift = new Tone.PitchShift({ pitch: 3, windowSize: 0.05 });
  const wobble = new Tone.Vibrato({ frequency: 7, depth: 0.35 });
  player.chain(shift, wobble, out);
  return [shift, wobble];
}

// The names here match data-voice="..." on the cards in index.html.
const VOICES = {
  helium:    { effect: helium },
  monster:   { effect: monster },
  robot:     { effect: robot },
  backwards: { effect: backwards, reversed: true },
  cave:      { effect: caveEcho },
  alien:     { effect: alien },
};


// ===== 3. App state + finding page elements =====
const state = {
  out: null,        // shared output: limiter -> speakers (made after the first tap)
  stream: null,     // the live microphone (only kept if RELEASE_MIC_AFTER_RECORDING is false)
  rec: null,        // info about the recording in progress
  busy: false,      // true while we decode a recording
  clip: null,       // { normal, reversed, seconds } – the current recording, ready to play
  playing: null,    // { player, nodes, name } – what is playing right now
  playToken: 0,     // increases on every tap, so a slow older tap can't overrule a newer one
  lastVoice: null,  // for the "play again" button
};

const $ = (id) => document.getElementById(id);
const welcome = $('welcome'), startBtn = $('start-btn'), welcomeMsg = $('welcome-msg'), welcomeEmoji = $('welcome-emoji');
const recordBtn = $('record-btn'), recordFace = $('record-face'), recordHint = $('record-hint'), ringFg = $('ring-fg');
const cardsBox = $('cards'), againBtn = $('again-btn');
const RING_LENGTH = 2 * Math.PI * 54;   // circumference of the ring circle (r = 54 in index.html)


// ===== 4. Start screen: unlock audio + ask for the microphone =====
async function onStartTap() {
  startBtn.disabled = true;
  welcomeMsg.hidden = true;

  if (!window.Tone) return showProblem('no-tone');
  // Browsers only allow sound after a tap. Tone.start() must run inside this tap.
  try { await Tone.start(); } catch (err) { console.warn('Tone.start failed', err); }
  if (!state.out) state.out = new Tone.Limiter(-1).toDestination(); // stops loud effects from crackling

  if (TEST_MODE) return hideWelcome();
  if (!window.isSecureContext) return showProblem('not-https');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
    return showProblem('no-support');
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); // shows the browser's permission popup
    if (RELEASE_MIC_AFTER_RECORDING) releaseStream(stream); else state.stream = stream;
    hideWelcome();
  } catch (err) {
    console.warn('Microphone error:', err.name, err.message);
    showProblem(err.name === 'NotFoundError' ? 'no-mic' : 'denied');
  }
}

const PROBLEMS = {
  'denied': ['😢', `<p><b>Monster Mic can't hear you.</b></p>
     <p>Grown-up: please allow the microphone for this website, then tap Try again.</p>
     <p>📱 iPhone: tap the page settings icon in the address bar → Microphone → Allow.</p>
     <p>🤖 Android: tap the icon left of the web address → Permissions → Microphone.</p>`],
  'no-mic':     ['🎤❓', `<p><b>No microphone found.</b></p><p>Is one connected?</p>`],
  'no-support': ['😕', `<p><b>This browser can't record.</b></p><p>Try Safari on iPhone or Chrome on Android.</p>`],
  'not-https':  ['🔒', `<p><b>The microphone needs a secure link.</b></p><p>Open the https:// address (or localhost on a computer).</p>`],
  'no-tone':    ['📡', `<p><b>The sound engine didn't load.</b></p><p>Check the internet connection and reload the page.</p>`],
};

function showProblem(kind) {
  const [emoji, html] = PROBLEMS[kind];
  welcome.hidden = false;
  welcomeEmoji.textContent = emoji;
  welcomeMsg.innerHTML = html;
  welcomeMsg.hidden = false;
  startBtn.textContent = 'Try again';
  startBtn.disabled = false;
}

function hideWelcome() { welcome.hidden = true; }

function releaseStream(stream) {
  if (stream) stream.getTracks().forEach((t) => t.stop());   // turns the mic (and the red mic icon) off
}

async function getStream() {
  if (state.stream && state.stream.active) return state.stream;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  if (!RELEASE_MIC_AFTER_RECORDING) state.stream = stream;
  return stream;
}


// ===== 5. Recording (hold the button) =====
function pickMimeType() {
  // Chrome/Android records webm, Safari/iPhone records mp4. Use the first one this browser supports.
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
  return options.find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
}

async function startRecording() {
  if (state.rec || state.busy) return;
  stopPlayback();
  Tone.start().catch(() => {});   // keep audio awake (iPhone sometimes pauses it)

  const rec = { wanted: true, chunks: [], recorder: null, stream: null, startedAt: 0, timer: 0 };
  state.rec = rec;
  setRecordLook('waiting');   // yellow while the mic switches on

  let stream;
  try {
    stream = await getStream();
  } catch (err) {
    console.warn('Microphone error:', err.name, err.message);
    state.rec = null;
    setRecordLook('idle');
    return showProblem('denied');
  }

  if (!rec.wanted) {          // finger was lifted before the mic was ready
    if (RELEASE_MIC_AFTER_RECORDING) releaseStream(stream);
    state.rec = null;
    setRecordLook('idle');
    return complain('✋ Hold it down!');
  }

  rec.stream = stream;
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  rec.recorder = recorder;
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) rec.chunks.push(e.data); };
  recorder.onstop = () => finishRecording(rec);
  recorder.start();
  rec.startedAt = performance.now();
  rec.timer = setTimeout(stopRecording, MAX_SECONDS * 1000);   // automatic stop at 15 s
  setRecordLook('recording');
  requestAnimationFrame(updateRing);
}

function stopRecording() {
  const rec = state.rec;
  if (!rec) return;
  rec.wanted = false;
  if (rec.recorder && rec.recorder.state === 'recording') {
    clearTimeout(rec.timer);
    rec.recorder.stop();        // this triggers recorder.onstop -> finishRecording
    setRecordLook('working');
  }
}

function updateRing() {
  // Called about 60 times a second while recording: fill the ring and count down.
  const rec = state.rec;
  if (!rec || !rec.recorder || rec.recorder.state !== 'recording') return;
  const elapsed = (performance.now() - rec.startedAt) / 1000;
  setRing(Math.min(elapsed / MAX_SECONDS, 1));
  recordFace.textContent = Math.max(1, Math.ceil(MAX_SECONDS - elapsed));
  requestAnimationFrame(updateRing);
}


// ===== 6. Turning the recording into sound data we can play =====
async function finishRecording(rec) {
  const seconds = (performance.now() - rec.startedAt) / 1000;
  if (RELEASE_MIC_AFTER_RECORDING) releaseStream(rec.stream);
  state.rec = null;

  if (seconds < MIN_SECONDS) {
    setRecordLook('idle');
    return complain('✋ Hold it down longer!');
  }

  state.busy = true;
  try {
    // The recording is a compressed file (webm or mp4). Decode it into raw samples (an AudioBuffer).
    const blob = new Blob(rec.chunks, { type: rec.recorder.mimeType || 'audio/mp4' });
    const bytes = await blob.arrayBuffer();
    const audio = await Tone.getContext().decodeAudioData(bytes);
    useClip(audio);
  } catch (err) {
    console.error('Could not decode the recording:', err);
    complain('😵 Oops, try again!');
  }
  state.busy = false;
  setRecordLook('idle');
}

function useClip(audio) {
  state.clip = prepareClip(audio);
  cardsBox.classList.remove('locked');
  recordHint.textContent = '👇 Tap a monster!';
}

function prepareClip(audio) {
  // Make two copies of the recording: a normal one and a backwards one.
  // We also "normalize": make it as loud as possible without clipping, so quiet phone mics still sound fun.
  const ctx = Tone.getContext();
  const channels = audio.numberOfChannels, length = audio.length;

  let peak = 0;
  for (let ch = 0; ch < channels; ch++) {
    const data = audio.getChannelData(ch);
    for (let i = 0; i < length; i++) { const v = Math.abs(data[i]); if (v > peak) peak = v; }
  }
  const gain = peak > 0.001 ? Math.min(0.9 / peak, 8) : 1;

  const normal = ctx.createBuffer(channels, length, audio.sampleRate);
  const reversed = ctx.createBuffer(channels, length, audio.sampleRate);
  for (let ch = 0; ch < channels; ch++) {
    const src = audio.getChannelData(ch), n = normal.getChannelData(ch), r = reversed.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const v = src[i] * gain;
      n[i] = v;
      r[length - 1 - i] = v;
    }
  }
  return { normal, reversed, seconds: audio.duration };
}


// ===== 7. Playback (tap a card) =====
async function playVoice(name) {
  if (!state.clip) return complain('👆 Hold the mic first!', true);
  const voice = VOICES[name];
  const token = ++state.playToken;
  stopPlayback();
  await Tone.start();   // wakes audio back up if the phone paused it

  const player = new Tone.Player(voice.reversed ? state.clip.reversed : state.clip.normal);
  const nodes = await voice.effect(player, state.out);

  if (token !== state.playToken) {   // another card was tapped while we were setting up
    player.dispose();
    nodes.forEach((n) => n.dispose());
    return;
  }

  state.playing = { player, nodes, name };
  state.lastVoice = name;
  player.onstop = () => {
    if (state.playing && state.playing.player === player) markPlaying(null);
  };
  player.start();
  markPlaying(name);
  againBtn.disabled = false;
}

function stopPlayback() {
  const p = state.playing;
  if (!p) return;
  state.playing = null;
  try { p.player.stop(); } catch (_) { /* already stopped */ }
  p.player.dispose();
  p.nodes.forEach((n) => n.dispose());
  markPlaying(null);
}


// ===== 8. Little UI helpers =====
function setRing(fraction) {
  ringFg.style.strokeDashoffset = RING_LENGTH * (1 - fraction);
}

function setRecordLook(mode) {   // 'idle' | 'waiting' | 'recording' | 'working'
  recordBtn.classList.remove('waiting', 'recording', 'working');
  if (mode !== 'idle') recordBtn.classList.add(mode);
  if (mode === 'idle' || mode === 'waiting') { recordFace.textContent = '🎤'; setRing(0); }
  if (mode === 'working') recordFace.textContent = '⏳';
  if (mode === 'recording') recordHint.textContent = '🗣️ Talk now!';
  if (mode === 'idle' && !state.clip) recordHint.textContent = '👆 Hold to talk';
}

function complain(text, shakeButton) {
  recordHint.textContent = text;
  const el = shakeButton ? recordBtn : recordHint;
  el.classList.remove('shake');
  void el.offsetWidth;            // restart the animation
  el.classList.add('shake');
}

function markPlaying(name) {
  document.querySelectorAll('.card').forEach((c) => c.classList.toggle('playing', c.dataset.voice === name));
}

function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);   // iPads pretend to be Macs
}

function makeTestClip() {
  // A fake 2-second "voice": a buzzy tone that slides up and down, in 4 syllables.
  const ctx = Tone.getContext(), sr = ctx.sampleRate, len = Math.floor(sr * 2);
  const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    phase += (150 + 60 * Math.sin(2 * Math.PI * 0.8 * t)) / sr;
    const saw = 2 * (phase % 1) - 1;
    d[i] = 0.4 * saw * Math.abs(Math.sin(2 * Math.PI * 2 * t));
  }
  useClip(buf);
}


// ===== 9. Wiring buttons to functions =====
startBtn.addEventListener('click', onStartTap);

// Pointer events work the same for finger, mouse and pen.
recordBtn.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  recordBtn.setPointerCapture(e.pointerId);   // keep getting "finger up" even if it slides off the button
  startRecording();
});
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => recordBtn.addEventListener(type, stopRecording));
recordBtn.addEventListener('contextmenu', (e) => e.preventDefault());   // no long-press menu

// Keyboard (handy on a computer): hold Space on the focused button.
recordBtn.addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); startRecording(); } });
recordBtn.addEventListener('keyup',   (e) => { if (e.code === 'Space') { e.preventDefault(); stopRecording(); } });

document.querySelectorAll('.card').forEach((card) => {
  card.addEventListener('click', () => playVoice(card.dataset.voice));
});
againBtn.addEventListener('click', () => { if (state.lastVoice) playVoice(state.lastVoice); });

if (isIOS()) $('silent-hint').hidden = false;
if (TEST_MODE) { const t = $('test-btn'); t.hidden = false; t.addEventListener('click', makeTestClip); }

// For poking around in the browser console: type monsterMic.state
window.monsterMic = { state, VOICES, playVoice, makeTestClip };
