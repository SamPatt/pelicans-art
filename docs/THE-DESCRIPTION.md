# The Description

A burglar pelican uses a police scanner to stay ahead of a description that keeps changing with him. The officer is standing behind him.

## Watch and edit

- Player: `/skit-player.html?captions=1&skit=theDescription`
- Captioned video: `src/media/the-description.mp4`
- Portable, voiced bundle: `src/published/theDescription.json`
- Local editor source: `data/skits/theDescription.json` (created by the build script)
- Authoritative artwork and blocking: `scripts/build-description.mjs`

The gallery includes a **The Description** selector. The existing featured skit is preserved.

## Dialogue, in order

1. Officer, scanner: “Suspect is a pelican on a bike wearing a striped shirt and a mask.”
2. Pelican: “Oh man, I'd better change.”
3. Officer, scanner: “Suspect now wearing a red floral shirt and sunglasses.”
4. Pelican: “I'd better hide this.”
5. Officer, scanner: “Suspect concealing a sack marked 'loot.'”
6. Officer, scanner, now revealed: “Suspect has finally noticed me.”
7. Pelican: “You could've said something.”
8. Officer, clean voice: “I have been.”

## Production

The burglar, red-shirt disguise, and sack-hiding pose share one authored SVG skeleton and bicycle. Costume changes use a cut between aligned cast poses. The officer's raised/lowered-radio poses use the same method, preserving the player's existing mouth and expression setup. These are poses of two characters, not additional story characters.

The scanner and loot are separate props. The scanner uses `prop-hold` with `svgMount: [77, 75, 0.32]` to mount inside the bicycle actor's body SVG; it inherits the actor's idle sway instead of drifting independently. Each costume cut remounts it into the next pose. Its label is omitted. The `radio` prop-animation preset flashes the receiver LED and displays signal rings throughout each transmission, including the squelch; an explicit null animation stops it afterward. Animation timers are cleared on replacement, stop, and replay.

The sack moves visibly before being replaced by a partially concealed sack drawn behind the hiding pose's body. The officer is onstage throughout playback but outside the opening medium shot. A wide shot reveals him; he does not enter. The first beats explicitly restore props so replay works after the blackout.

All eight lines are embedded audio. The four scanner transmissions have band-limited speech and short authored squelch sounds; the final reply is unfiltered. Effects are baked into each MP3, so the player, portable export, and MP4 capture share the same sound without new runtime effects or API calls. Timing uses sequential speech completion and explicit reaction pauses.

The revised audio speeds police reports up by 23% without changing pitch; clean police speech is 12% faster. Pelican takes were regenerated with a pause prefix, slowed to 82%, and given protected leading/trailing audio. Scanner squelch is 400 ms in / 280 ms out, with a small gap before speech. There is a 1.35-second scripted pause after “Oh man, I'd better change” and 1 second of scripted silence before the officer's final answer (in addition to the player's normal speech-completion spacing).

## Rebuild

```sh
node scripts/build-description.mjs
# Optional: synthesize or reuse local voice WAVs, process them, and rebuild the bundle.
# Requires Pocket TTS already running on 127.0.0.1:8001.
node scripts/voice-description.mjs
node scripts/capture-skit.js --skit theDescription
```

The voice script caches raw takes under `artifacts/description/audio`; remove a particular raw take before changing its text or casting. Cached processed audio is embedded by the build script. If local MP3s are absent, unchanged dialogue and casting retain their audio from the existing published bundle. Lines with neither source remain caption-only until synthesized.

## Provenance

SVG artwork, script, staging, and radio squelch were authored directly in this Codex task for Sam Patt. No OpenRouter, OpenAI API, image-generation API, or paid speech API was called. Speech was synthesized on the user's machine by the installed Kyutai Pocket TTS model using its bundled Marius (pelican) and Javert (officer) voices. No supplied recording or public-figure voice clone was used. Original creative assets follow `ASSET-LICENSE.md`.

Revision 3 adds a quiet, band-limited static bed throughout each complete radio transmission (including pauses and squelch). The officer switches to his lowered-radio pose immediately after his last transmission; the final reply pause remains in place.

Revision 4 places the officer behind the right-facing cyclist (officer on the left, cyclist on the right). The first shots exclude the left side. A backward glance motivates the wide reveal, followed by an aligned, left-facing head pose; the bicycle and mounted scanner keep their orientation. The final scripted reply pause is shortened to one second.

## Public release

- Pouch entry: https://pelicans.art/community.html?type=published&id=the-description-f8ccb1
- Watch: https://pelicans.art/skit-player.html?captions=1&skit=theDescription
- Captioned MP4: https://pelicans.art/media/the-description.mp4

The release includes the scanner's SVG attachment and radio-animation support, timer cleanup, and smaller phone captions. It also includes the previously uncommitted background/visible-cast scene support that this skit depends on, plus support for preserving all scene backgrounds in portable exports. Unrelated editor and voice-provider changes are excluded. Audio filtering is performed by the local build script and embedded in the bundle, not generated during playback.

The Model field is **GPT-6 Astra** for this skit and all six character poses, both props, and both backgrounds. Speech remains attributed to Pocket TTS in the production notes. The reusable assets and script are uploaded to Pouch; their permanent identifiers are recorded in `docs/description-pouch-assets.json`. The upload utility retains this receipt and skips previously uploaded assets.

Preferred share link: https://pelicans.art/watch/the-description/
