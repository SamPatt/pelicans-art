# Companion Editor

Open [pelicans.art/editor.html](https://pelicans.art/editor.html) on a desktop or phone. No agent connection, model key, or speech setup is needed to edit and preview a project.

1. Choose **Open project** and select the agent's built `output/project.json` or a previous Editor export. The original file is unchanged. **Try The Description** provides a recorded sample.
2. Select a character on the stage or in the cast list. Drag it, or enter its opening position and size. Playback applies the existing camera shots and stage directions; the layout view shows the opening cast plus a selected later character.
3. Select a dialogue line or pause. Save your change, insert a pause, move an action, or remove it. Undo/Redo covers these edits. Stage directions are preserved and can be shown when needed.
4. **Play skit** previews existing audio with captions. It never calls a model or speech provider. Changing a line removes its stale recording and marks it **Voice needs update**. Reordering lines preserves the recordings belonging to them.
5. **Export project** saves an editable JSON bundle. Send the latest export to your agent for new speech and a rendered MP4. The browser Editor does not render a new MP4 itself.

**Copy request for your agent** includes your selected character or scene, the current script, and the project revision. Paste it into any agent chat and attach the export if the agent does not already have it. Browser storage saves the current project on this device; exporting is your portable backup. There is no cross-device sync.

## Optional Hermes chat

Run the theater beside an already configured Hermes installation. Verify `hermes acp --check`; if ACP is absent, install Hermes's ACP extra following its official instructions. This connection uses the existing Hermes model configuration, credentials, and normal usage. It starts a new ACP conversation; it does not resume Telegram or unrelated terminal chats.

```sh
HERMES_EDITOR_ENABLED=1 npm start
# Open http://127.0.0.1:3000/editor, then Connect your agent.
```

`HERMES_EDITOR_COMMAND` can name an absolute executable when `hermes` is not on PATH. The server passes `acp` as its argument and never accepts executable names or shell commands from the browser. `HERMES_EDITOR_CWD` optionally selects the ACP session directory. By default it uses the server's current directory. For a private VPS, set `HERMES_EDITOR_ORIGIN` to the exact private HTTPS origin (and configure `CORS_ORIGIN` for the same origin when terminating TLS at a proxy), and use an existing authenticated private proxy/tunnel; do not expose the authoring server publicly or connect the public static page directly to your VPS.

The first release supports proposed title, dialogue, pause, character position/size, existing-backdrop, and selected-SVG edits. Hermes sees text context and the selected character SVG, not the audio recordings. It is instructed to propose changes without tools. If it requests a tool permission anyway, the Editor presents allow-once/deny choices; it never automatically approves or offers persistent approval. Hermes itself remains a trusted agent with its configured capabilities—this is not an operating-system sandbox.

Review the reply, then **Apply proposed edits**. All edits are validated and applied as one undoable change. If the project changed while Hermes was responding, the proposal is rejected: ask again with current context. **Stop** cancels a turn; **Disconnect** ends the ACP process. Sessions expire after 30 minutes without requests. Closing the chat panel hides it; use Disconnect to end the session.

New audio and final video rendering remain in the ordinary agent/CLI workflow. Export the project and continue there. The chat does not claim to have regenerated recordings.

## Compatibility and rollback

Old `sprite-editor.html` links redirect to Editor. The previous interface remains at `legacy-studio.html` for migration/rollback and has no link in the normal product flow. Its integration tests remain separate from the new Editor tests. Existing project files and recordings are not migrated in place.
