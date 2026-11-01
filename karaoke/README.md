# Starlight Stage

A karaoke game that runs in the browser. Pick a song, sing it with your real mic or the virtual mic, and unlock new mics as you go.

## Play it

Double-click **`Starlight Stage.html`** (next to this folder) and press **PLAY**. It's the whole game in one file, so it can be copied or emailed by itself. Use Chrome, Edge or Firefox for the real mic. Safari may block the mic on files opened from disk.

If you change anything in this folder, rebuild that file with `python3 build.py`.

To use your microphone, open **Mic setup**, choose **Real mic**, and allow the mic when the browser asks. Headphones keep the music out of the mic.

## Files

- `index.html`: the screens (lobby, library, stage, results, mic locker) and dialogs
- `style.css`: the neon club look and all animation
- `app.js`: the game engine (synth band, pitch detection, scoring, reactions, unlocks, saved progress)
- `build.py`: bundles everything into the single `Starlight Stage.html`
- `songs.js`: the built-in songs. All titles, artists, lyrics and melodies are originals written for this game.

## Adding songs

- **In the game:** use **+ Add your own** to add a music file plus lyrics. Lyrics with LRC timestamps such as `[00:12.50] First line` line up exactly. Lyrics without timestamps are spread evenly across the song. These songs are saved in that browser only.
- **Built-in:** add an entry to `songs.js`. Follow the format comment at the top of the existing entries:
  - each line's notes add up to whole 4/4 bars
  - each note has one syllable (`-` joins a syllable to the next one, `~` holds the previous syllable over an extra note)
  - rap uses `x` for spoken notes

Only add lyrics you wrote or that are in the public domain.
