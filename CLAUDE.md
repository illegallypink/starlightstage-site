# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Sing in Bloom" is a single-page singing website: pink text, flowers everywhere, a playable flower piano, vocal warm-ups that play their notes, singing tips and song ideas. The whole site is one self-contained file, `index.html`. It has inline CSS and JS, no build step, no dependencies and no tests.

The file starts with `<title>` and `<style>` and has no `<html>`, `<head>` or `<body>` tags, because the Artifact publisher wraps it in a skeleton. Browsers render it fine without them.

## Deployment safety

Only ever create or change Kubernetes resources in namespace starlightstage. Never delete anything. Always show me the YAML and explain it before applying.

## Commands

- View locally: `open index.html`
- Syntax-check the script:
  ```sh
  sed -n '/<script>/,/<\/script>/p' index.html | sed '1d;$d' > /tmp/s.js && node --check /tmp/s.js
  ```

## Architecture (inside index.html)

- **Theme tokens:** all colors and fonts are CSS custom properties on `:root`. The dark palette redefines the same tokens twice, once under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`, and once under `:root[data-theme="dark"]`. Add new colors as tokens in all three blocks, never as literals. The fonts are Pacifico (display) and Nunito (body), loaded from Google Fonts. The Artifact page rules don't allow fonts from any other host.
- **Flowers:** a single JS helper, `flower({petals, color, size})`, returns an inline SVG. The petal color is passed through the `--k` CSS variable, so it can reference theme tokens such as `var(--petal-1)`. The hero cluster, section dividers (`[data-vine]`), footer garden, falling petals, click bursts, piano keys and tip bullets are all generated from it at load time.
- **Audio:** Web Audio API only, with no audio files. `audio()` creates the AudioContext on first use, because browsers block sound until a click or tap. `voice(freq, start, dur, glide)` is the one synth voice: triangle and sine oscillators, a vibrato LFO, a low-pass filter and a gain envelope. Passing `glide` makes the pitch slide, which the "Sirens" warm-up uses.
- **Sequences:** melodies are written as strings parsed by `seq()`. Each token is `NOTE:beats[:glideTarget]`, and `-` is a rest. Notes must be one of the 12 in `NOTES`, C4 through G5. `playSeq` schedules the audio ahead on the audio clock and lights up keys with `setTimeout`. Only one sequence plays at a time: `seqId` cancels stale timers, and `activeBtn` tracks which button shows "■ Stop". `toggle(btn, steps, bpm)` is the play/stop handler shared by every button.
- **Audio extras for karaoke:** `voice()` takes an optional 5th argument, `{level, vib, bright}`, used to make quieter, darker backing tones. `hz(name)` converts any note name (such as `C3` or `F#2`) to Hz, and only the backing uses it. Melodies still use `freqOf`/`NOTES`. `playSeq(steps, bpm, btn, opts)` and `toggle(..., opts)` take optional `opts`:
  - `mute`: skip the melody voice
  - `backing`: `[{at, freq, beats, tone}]`, timed in beats from the start
  - `onStep(i, durSec)`
  - `onStop(ended)`: fires when the sequence ends or another one replaces it, through `stopSeq(ended)`

  Never pass `stopSeq` straight to `addEventListener`.
- **Karaoke:** songs in `KARAOKE` must be public domain only. Each line is `[melody, syllables, chords]`:
  - Syllables are separated by spaces. `Twin-` joins the next syllable, and `~` holds the previous syllable over an extra note.
  - Chords use `seq()` syntax (`C:4 F:2`, with `-` for no chord) and must add up to the same number of beats as the melody.

  `buildKaraoke()` prefixes count-in rests and builds the chord timeline. It logs `console.warn` when the note and syllable counts or the beat totals don't match.
- **Karaoke styles:** `STYLES` has one backing style per genre, keyed by the same ids as `GENRES` (plus `singalong`), so a genre page can set the machine's style. `buildBacking(song, built, style)` walks the chord timeline on an eighth-note grid and calls the style's `play(x)`, which adds notes (voicings from `CHORDS`) and drum hits. `drum(kind, t)` is a synth kit (`kick`, `snare`, `hat`, `ride`), and `playSeq` schedules backing events that carry `drum` through it.
- **Content data:** the songs in `SONGS`, the warm-up cards in `WARMUPS`, the tips in `TIPS` and the genres in `GENRES` are JS arrays rendered at load time. The "Song Ideas" section is static HTML.
- **Genre pages:** the page has two views, `#home` and `#genrePage`. `route()` runs on `hashchange` and shows the genre page when the hash is a `GENRES` id (`#pop`, `#rnb`, `#theatre`, `#jazz`, `#country`, `#rock`, `#gospel`, `#classical`), otherwise the home view. Artifact links only pass bare `#token` hashes, so keep ids to letters only.
- **YouTube:** Artifacts can't embed iframes, so instrumentals are YouTube search links (`ytSearch()`) that open in a new tab. Never hard-code video IDs. The karaoke "Next line" button steps through the lyrics by hand for singing along to one of those tracks.
- **Motion:** every animation and the falling petals and click bursts are disabled under `prefers-reduced-motion`.

## Karaoke game (karaoke/)

`karaoke/` is a separate, newer site: "Starlight Stage", a karaoke game. It is multi-file (`index.html`, `style.css`, `app.js`, `songs.js`). See `karaoke/README.md`. `python3 karaoke/build.py` bundles it into one double-clickable file, `Starlight Stage.html`, in the repo root. Rebuild after every edit. In Chrome the real mic works from that file, but published claude.ai Artifacts can't use the mic.

- **Songs:** `songs.js` holds original songs only (no real-song lyrics). Each line's `notes` add up to whole 4/4 bars, `chords` loop one per bar from the first intro bar, and rap uses `x` notes.
- **Audio:** `BANDS[genre]` plays one bar of a genre's backing through a look-ahead scheduler. Pause uses `ctx.suspend()`.
- **Scoring:** the real mic uses autocorrelation in `readMic()`, folded to the nearest octave. The virtual mic gives full credit only if you pressed again after each phrase's gap (`markPhrases`).
- **Saved state:** progress and mic unlocks are in localStorage (`starlight-stage-v1`). Songs the player adds are in IndexedDB (`starlight-stage`).
