# Monster Mic 👾🎤

A voice-changer web app for phones. Hold the mic button to record, then tap a monster to hear yourself transformed.

## Files
- `index.html` – the page layout (start screen, record button, 6 voice cards)
- `style.css` – colours, sizes, animations, kid-proofing (no text selection or long-press menu)
- `app.js` – the logic: microphone, recording, decoding, the 6 voice effects, playback

## Run it on your computer
```bash
cd ~/Documents/Claude\ Projects/Voice\ Changer\ App
python3 -m http.server 8000
```
Then open http://localhost:8000 in Chrome or Safari. Press Ctrl+C in the terminal to stop the server.

- `http://localhost:8000/?test` adds a 🧪 button that makes a fake clip, so you can try the effects without a microphone.
- Phones can't use the mic through `http://<your-computer's-IP>:8000` (the mic needs https), so for phones use GitHub Pages.

## Tune the voices
Open `app.js`, section 2. Each voice is a small function with numbers you can change (pitch, echo time, and so on).

## Ideas for later
**More voices with plain Tone.js (no new library):**
- 👾 8-bit: `BitCrusher`
- 🛸 weird alien: `FrequencyShifter`
- 🫧 underwater: low-pass `Filter` + `Chorus`
- 📞 telephone: band-pass `Filter` + a little `Distortion`
- 🎧 ping-pong echo: `PingPongDelay`
- 🥶 shiver: `Tremolo`
- 🐿️ chipmunk / 🦣 giant: `player.playbackRate` 1.6 / 0.6 (cleanest sound, no slicing)

**Add a library only when needed:**
- SoundTouchJS: cleaner pitch shifting, if PitchShift sounds rough again
- `Tone.Convolver` + free impulse-response files: realistic cave or cathedral reverb
- wavesurfer.js: live waveform + tap-to-scrub chunk

## Publish an update (after the first setup)
```bash
git add .
git commit -m "Describe what changed"
git push
```
GitHub Pages updates about a minute later.
