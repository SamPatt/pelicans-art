# Companion Editor

Open [pelicans.art/editor.html](https://pelicans.art/editor.html) on a desktop or phone. No agent connection, model key, or speech setup is needed to edit and preview a project.

1. Choose **Open project** and select the agent's built `output/project.json` or a previous Editor export. The original file is unchanged. **Try The Description** provides a recorded sample.
2. Select a character on the stage or in the cast list. Drag it, or enter its opening position and size. Playback applies the existing camera shots and stage directions; the layout view shows the opening cast plus a selected later character.
3. Select a dialogue line or pause. Save your change, insert a pause, move an action, or remove it. Undo/Redo covers these edits. Stage directions are preserved and can be shown when needed.
4. **Play skit** previews existing audio with captions. Playback never calls a model or speech provider. Changing a line removes its stale recording and marks it **Voice needs update**. Reordering lines preserves the recordings belonging to them.
5. **Export project** saves an editable JSON bundle. On a private installation, **Update voices** generates missing recordings and **Render video** updates voices then produces a downloadable MP4. These buttons use the server; public static editing still works without it. Export remains available for continuing in any agent chat.

**Send request to Hermes** appears beside the selection note when connected and sends that note with the selected character/scene directly into chat. Replies and proposed edits appear in the chat panel. The header shows connecting, connected, working, or disconnected status even when chat is closed. Copy remains available as a secondary action. When disconnected, **Copy request for your agent** includes your selected character or scene, the current script, and the project revision. Paste it into any agent chat and attach the export if the agent does not already have it. Browser storage saves the current project on this device; exporting is your portable backup. There is no cross-device sync.

## Optional Hermes chat

Run the theater beside an already configured Hermes installation. Verify `hermes acp --check`; if ACP is absent, install Hermes's ACP extra following its official instructions. This connection uses the existing Hermes model configuration, credentials, and normal usage. It starts a new ACP conversation; it does not resume Telegram or unrelated terminal chats.

```sh
HERMES_EDITOR_ENABLED=1 npm start
# Open http://127.0.0.1:3000/editor, then Connect your agent.
```

`HERMES_EDITOR_COMMAND` can name an absolute executable when `hermes` is not on PATH. The server passes `acp` as its argument and never accepts executable names or shell commands from the browser. `HERMES_EDITOR_CWD` optionally selects the ACP session directory. By default it uses the server's current directory. For a private VPS, set `HERMES_EDITOR_ORIGIN` to the exact private HTTPS origin (and configure `CORS_ORIGIN` for the same origin when terminating TLS at a proxy), and use an existing authenticated private proxy/tunnel; do not expose the authoring server publicly or connect the public static page directly to your VPS.

The first release supports proposed title, dialogue, pause, character position/size, existing-backdrop, and selected-SVG edits. Hermes sees text context and the selected character SVG, not the audio recordings. It is instructed to propose changes without tools. If it requests a tool permission anyway, the Editor presents allow-once/deny choices; it never automatically approves or offers persistent approval. Hermes itself remains a trusted agent with its configured capabilities—this is not an operating-system sandbox.

Review the reply, then **Apply proposed edits**. All edits are validated and applied as one undoable change. If the project changed while Hermes was responding, the proposal is rejected: ask again with current context. **Stop** cancels a turn; **Disconnect** ends the ACP process. Sessions expire after 30 minutes without requests. Closing the chat panel hides it; use Disconnect to end the session.

Hermes can propose `action: "voices"` or `action: "render"` alongside edits (or with an empty changes array). Applying the proposal uses the same server jobs as the buttons. The updated bundle loads back into the preview, and rendering offers an MP4 download. Character controls include voice preset, independent tempo (0.5–2×), and pitch (-12–12 semitones); changing these invalidates only that character’s recordings. Tempo/pitch are applied to the generated audio and travel with the exported project.

The server reuses the CLI build/render pipeline with the pinned Pocket profile. Start the installed Pocket service using the command emitted by `setup --tts` and verify it with `doctor --endpoint http://127.0.0.1:8001/tts --wait 120`. By default the Editor uses `TTS_URL` plus `/tts`. For another already configured compatible engine, `HERMES_EDITOR_TTS_CONFIG` names a server-local JSON file containing the CLI **tts object** (engine, endpoint, and any model/credential environment references). Browser requests cannot choose endpoints or executables. Use preset names supported by that engine; the pinned April Pocket catalog includes javert and all other shipped presets. The three audition voices are defaults, not a restriction on existing selections. An unavailable speech service fails the job without changing the project.

Jobs run in isolated temporary directories, with two concurrent jobs permitted, a 15-minute process limit, and a 24-hour download lifetime. A server restart ends access to old job links. Download artifacts before leaving. **Stop job** cancels the active job. If the project changes during work, the completed snapshot stays downloadable without replacing newer edits. No job publishes to the Pouch automatically.

## Compatibility and rollback

Old `sprite-editor.html` links redirect to Editor. The previous interface remains at `legacy-studio.html` for migration/rollback and has no link in the normal product flow. Its integration tests remain separate from the new Editor tests. Existing project files and recordings are not migrated in place.

The voice dropdown lists the pinned presets. See [Pocket voice sources](POCKET-VOICES.md) for audition libraries and how additional voices can be evaluated and pinned.
