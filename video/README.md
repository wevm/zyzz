# Launch Video

A Remotion composition of the Zyzz launch video: nine sections that follow the launch thread, timed to a 136.08 BPM soundtrack.

## Render

```sh
# Mix the soundtrack, then render out/zyzz-launch.mp4
pnpm render

# Preview and scrub the timeline
pnpm studio
```

`pnpm soundtrack` renders the sound effects with headless Chromium (`scripts/sfx.ts`), then mixes them with ffmpeg (`scripts/soundtrack.ts`). Set `CHROMIUM_PATH` to use a specific browser build.

## Music Bed

The music bed is the instrumental first chorus of John O'Callaghan's "Find Yourself" (Zyzz Version V2). It is a commercial recording, so it is not committed and must be licensed before the video is published. Without it, the soundtrack contains sound effects only.

To prepare `audio/instrumental.wav` from a local copy of the track:

```sh
# 1. Separate the vocals with Demucs
python -m demucs --two-stems=vocals -n htdemucs -o stems song.mp3

# 2. Cut 36 bars at 136.08 BPM, starting four bars before the first chorus
ffmpeg -ss 141.683 -t 63.492 -i stems/htdemucs/song/no_vocals.wav audio/instrumental.wav
```

Scene starts, annotation beats, and sound cues all derive from the beat grid in `src/Theme.ts`, so frame 0 must land on the downbeat at 141.683 seconds.
