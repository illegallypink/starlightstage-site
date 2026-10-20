# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Sing in Bloom" is a single-page singing website: pink text, flowers everywhere, a playable flower piano, vocal warm-ups that play their notes, singing tips and song ideas. The whole site is one self-contained file, `index.html`. It has inline CSS and JS, no build step, no dependencies and no tests.

It is also published as a private claude.ai Artifact: https://claude.ai/artifact/WDXKo9kahkcRitz3cr3VTZ. After editing, republish `index.html` to that same URL to keep the link. The file starts with `<title>` and `<style>` and has no `<html>`, `<head>` or `<body>` tags, because the Artifact publisher wraps it in a skeleton. Browsers render it fine without them.

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
- **Content data:** the songs in `SONGS`, the warm-up cards in `WARMUPS` and the tips in `TIPS` are JS arrays rendered at load time. The "Song Ideas" section is static HTML.
- **Motion:** every animation and the falling petals and click bursts are disabled under `prefers-reduced-motion`.
