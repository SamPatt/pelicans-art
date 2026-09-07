# Authoring contract

Commands run from the runtime checkout. Use absolute project paths when the agent changes working directories:

```sh
node scripts/theater.mjs init data/projects/my-skit
node scripts/theater.mjs finish data/projects/my-skit
```

`project.json`: keep the complete pinned `tts` profile emitted by `init` or `import`; change only the endpoint to your scoped service. Do not substitute the `english` alias or manually shorten the profile. Existing supplied recordings are retained; revised lines use the new preset profile. Other authorized speech engines need their own configuration without Pocket profile fields.

`skit.json` follows the player's format: meta (title/model), stage (background/orientation), cast (role -> sprite/x/voice), optional props, sequential script, and assets. Init writes a complete original example with two voices. Modify it rather than guessing the schema.

Assets maps:

- `sprites`: `pelican-front` -> `assets/pelican.svg`; variants use the same sprite prefix.
- `spriteMeta`: `pelican` -> metadata including name/model.
- `backgrounds`: background name -> relative SVG file.
- `props`: prop asset name -> relative SVG file; `propMeta` holds metadata.
- `audio`: `line-0` -> a relative WAV/MP3/OGG file or embedded data URL, counted only across `say` actions. Supplying audio explicitly takes priority over synthesis. When editing a supplied recording's text, replace/remove that recording too.

Build resolves paths inside the project directory (including symlink targets). It rejects external SVG references/executable markup. Embedded base64 media is accepted. Output `output/project.json` is a self-contained player/GUI bundle, not the source configuration file of the same basename. `.cache/` stores reusable speech; `output/build-manifest.json` records hashes and dialogue mapping. Keep all source files for revisions.

For new artwork, read [SVG art direction](art-direction.md); preserve the user’s style choices and existing assets when revising.

SVG actors need `viewBox="0 0 100 150"` and body/head groups: `body`, `head-top`, `head-bottom`. Eye IDs: `eye-left-white`, `eye-right-white`, `eye-left-pupil`, `eye-right-pupil` (pupils have class `pupil`). Brows: `brow-left`, `brow-right`. Mouth: `mouth-closed`, `mouth-open` (initial opacity 0), aligned vertically. Use the initialized SVG as a structural template. Backgrounds normally use 1280×720 or 720×1280. The runtime's `docs/SPRITE-GUIDE.md` contains further animation details.

Common script actions:

```json
[
  {"do":"background","name":"harbor","show":["customer","clerk"]},
  {"do":"shot","type":"wide"},
  {"do":"say","who":"customer","line":"I need a refund."},
  {"do":"pause","duration":0.6},
  {"do":"emote","who":"clerk","emotion":"surprised"},
  {"do":"look","who":"clerk","at":"left"},
  {"do":"shot","type":"closeup","who":"clerk"}
]
```

`duration` is seconds. `who` references cast roles, not asset names. Script variants/props must exist. Run validate for the exact accepted action set; current actions are in `server/middleware/validate.js` and behavior in `src/js/skit-player.js`. Do not invent tween/effect actions the player cannot execute.

Set `meta.model` and each newly authored asset's metadata model to your actual model when known, else Unknown. Speech configuration's model is separate and participates in cache invalidation: update it if the endpoint's loaded model changes. Do not put secrets in project configuration. Optional auth: `tokenEnv`, `authHeader` (default Authorization), `authPrefix` (default `Bearer `).

Editor: open `/editor.html`, choose **Open project**, and select `output/project.json`. Users can adjust character positions/size, dialogue and pauses, preview existing recordings, and **Export project**. Changed dialogue loses only its stale recording; unchanged lines retain audio. Treat the latest exported bundle as the source of truth: use `import <new-directory> --bundle <downloaded-json>` to resume in the CLI, regenerate changed speech, and render. **Copy request for your agent** includes the selected character or scene; ask for the export if it is not available in your workspace.

Optional in-editor Hermes chat runs only through the user's private theater server with `HERMES_EDITOR_ENABLED=1` and an already configured `hermes acp` executable. See the runtime's `docs/EDITOR.md` for configuration. It proposes undoable edits and can request voice regeneration or MP4 rendering after Apply. The Editor’s **Update voices** and **Render video** buttons use the same private server jobs, which return updated recordings to the preview. Ensure the configured TTS service is ready. Export/import remains available for external agent chats. The public Editor works without this connection.

In the connected Editor, the selection note can be sent directly to Hermes; the header shows connection/working status. Users can choose existing pinned voices from the Voice preset dropdown. Read `docs/POCKET-VOICES.md` in the runtime when evaluating additional voice sources.


## Speech substitutions and future edits

If local Pocket was requested and installation or readiness fails, report whether the failure occurred during preflight, dependency installation, model loading, or synthesis. Do not describe an architecture rejection as a Pocket synthesis failure. Preserve the diagnostics and obtain the user's choice before substituting a cloud provider, even if that provider is already configured in the agent.

When the user chooses agent-supplied recordings, record the actual provider and actual voice name for each character in delivery notes. Different rate settings on one voice are not distinct voices. Use cast voice values compatible with the intended future synthesis endpoint; bookkeeping labels for supplied files must not be presented as selectable Pocket presets.

Embedded audio makes existing dialogue playable, not automatically regenerable. Before promising editable voiced delivery, either verify the configured endpoint and preset voices for future changed dialogue, or clearly state that revised lines require the agent to regenerate and reattach supplied recordings. Do not claim a localhost endpoint is ready merely because its URL remains in project.json. Preserve existing recordings; if switching to Pocket for revisions, explicitly choose supported Pocket voice names and review any resulting recording invalidation. Test one changed line when claiming that the project's voice revision path works.

## Staging and camera framing

Cast `x` and `y` are percentages of the stage: x is the actor's horizontal center; y is its bottom anchor (default near the floor). Keep the entire painted actor inside the stage in the chosen orientation. Actor `scale` affects its displayed size; judge a preview rather than assuming one SVG unit is one screen pixel. Use a wide shot to establish the setting.

Closeup, medium, and extreme-closeup shots target actual SVG eye/mouth geometry, including nested transforms and facing direction. Head groups provide a fallback; older actors without recognizable face elements use the legacy 35%-height target. Keep the documented face IDs on unconventional actors too; do not translate all artwork merely to satisfy a presumed fixed face anchor. Camera follow retains the face offset while the actor moves.

A two-shot fits the visible painted cast with margins, up to 1.4x zoom; wide retains the full stage at 1x. Camera fitting cannot recover artwork placed outside the original stage. For crowded portrait scenes, reduce actor sizes or change staging rather than repeatedly changing face anchors. Check caption clearance in the contact sheet, especially on closeups. The recording synchronization marker is outside the exported frame; do not cover a corner with a postprocessing patch.

## Entrances and visible props

Set initial cast visibility in the cast configuration so both the opening cover and playback preserve the reveal. `x` is the final stage position; `startX` is the initial position. A `background.show` action changes visibility during playback, but does not hide actors in the pre-play cover. Props are hidden by default: use `visible: true` for a warning lamp or other prop present at the start. Animating a hidden prop does not reveal it.

```json
{
  "cast": {
    "captain": {"sprite":"captain", "x":36, "y":84, "voice":"jean"},
    "duck": {"sprite":"duck", "x":68, "y":84, "startX":120, "startOffscreen":true, "voice":"marius"}
  },
  "props": {
    "warning": {"prop":"alarm", "x":88, "y":12, "visible":true}
  },
  "script": [
    {"do":"shot", "type":"wide"},
    {"do":"say", "who":"captain", "line":"Activate emergency backup!"},
    {"do":"enter", "who":"duck", "from":"right", "to":68},
    {"do":"pause", "duration":1.5},
    {"do":"say", "who":"duck", "line":"You called?"}
  ]
}
```

This is a fragment: register the actual sprite/background/prop assets in the initialized project. Entrance movement takes 1.2 seconds and runs asynchronously; add an explicit pause if the next line should wait until the entrance settles. `from: "left"` uses the left edge; use a negative `startX` for that opening position. Inspect the opening and reveal once, using the contact sheet or an optional early preview when the staging is uncertain.

## Choose the comic pace before production

Propose brisk, conversational, or dry with reaction pauses during chat review. These are creative choices, not new JSON fields or global playback-speed settings. Translate the agreed choice into explicit pauses at important exchanges, visual reveals, and punchlines. Start with roughly 0.4–0.7 seconds of added space at selected conversational turns, or 0.7–1.2 seconds for a dry reaction; vary deliberately rather than applying a delay to every line. The player already waits about 0.2 seconds after an ordinary sequential recording.

Keep fast character delivery if intentional. When an individual recording is hard to follow, audition or revise that line instead of slowing the whole skit. Duration estimates in the proposal are approximate: compare the completed duration and `pacing` advisories with the agreed feel. Words/minute includes recording silence and is unreliable for very short utterances; a hint does not prove poor delivery. Preserve the approved script and reuse speech when changing pauses only.
