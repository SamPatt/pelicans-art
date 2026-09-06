# Authoring contract

Commands run from the runtime checkout. Use absolute project paths when the agent changes working directories:

```sh
node scripts/theater.mjs init data/projects/my-skit
node scripts/theater.mjs validate data/projects/my-skit
node scripts/theater.mjs build data/projects/my-skit
node scripts/theater.mjs render data/projects/my-skit
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

GUI: open `/sprite-editor.html?mode=browser`, choose Import agent project, and select output/project.json. Use Render then Download to export a self-contained bundle after editing. Unchanged imported lines retain audio; changed text/casting requires newly generated speech or becomes unvoiced if the GUI is in captions-only mode. To resume in the CLI, use `import <new-directory> --bundle <downloaded-json>`; then edit and render as usual.
