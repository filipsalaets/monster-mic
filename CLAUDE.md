# Monster Mic – notes for Claude

A fun voice-changer web app for phones (iPhone + Android). Hold a button to record,
tap a voice card to hear the recording transformed. Users are my kids (9 and 6).

Live site: https://filipsalaets.github.io/monster-mic/
Repo: https://github.com/filipsalaets/monster-mic (branch `main`, Pages serves the root)

## About me and how to work with me
- I have a computer science background but my coding is ~20 years rusty. This is my first coding project with Claude Code.
- Work in small steps. Briefly explain each change in plain words. I want to learn, not just get a result.
- For a new chunk of work: propose a short plan first and wait for my OK before building.
- After building: test locally in the browser, say clearly what was and wasn't verified, then give me the git commands to publish.
- I run the git commands myself (to learn). Don't commit or push for me unless I ask.
- Give shell commands one per code block so I can copy/run each one.

## Hard rules
- Plain HTML, CSS and JavaScript only: `index.html`, `style.css`, `app.js`. No frameworks, no build tools, no npm.
- Only free tools. No accounts or paid services besides GitHub.
- Libraries only from a CDN with an exact pinned version (currently Tone.js 15.0.4 from cdnjs).
- Mobile-first, portrait, big touch targets (cards ≥ 120px), bright colours, icons over text: a 6-year-old must understand it without help.
- Stay inside the agreed chunk; don't build features from later chunks.

## Code layout
- `app.js` is split into numbered sections. Section 2 holds one small function per voice, with tunable numbers at the top of each.
- Adding a voice = new effect function + an entry in `VOICES` + a card with matching `data-voice` in `index.html`.
- Backwards uses a pre-reversed copy made in `prepareClip` (don't use Tone's `player.reverse`: it reverses the shared buffer in place).

## Known gotchas (already handled; keep them working)
- Audio must be unlocked by a tap: `Tone.start()` on the start screen and before playback.
- Safari records audio/mp4, Chrome records audio/webm; both are decoded to an AudioBuffer.
- Mic needs https or localhost.
- iPhone: a live mic routes output to the quiet earpiece, so the mic is released after each recording (`RELEASE_MIC_AFTER_RECORDING`).
- iPhone silent switch can mute web audio: hint is shown on iOS.
- `Tone.PitchShift` sounds gravelly with small `windowSize`; 0.1–0.15 tested fine on phones.

## Testing
- Run locally: `python3 -m http.server 8000` in this folder, open http://localhost:8000.
- `?test` in the URL skips the mic and shows a "test clip" button.
- Claude's built-in browser pane blocks the microphone. To test the recording path there, temporarily override `navigator.mediaDevices.getUserMedia` with an oscillator stream in the page. `window.monsterMic` exposes state and `playVoice` for console checks.
- Real-phone testing (Safari + Chrome) is done by me via the live site.

## Roadmap
- Chunk 1 (done): record up to 15 s, 6 voices, switch voices, replay, deploy.
- Later chunks (not built yet): live waveform, confetti/vibration, tap-to-scrub, sharing/download, QR code, sliders, saving clips, offline/PWA, extra voices.
- Library and voice ideas: see "Ideas for later" in README.md.
