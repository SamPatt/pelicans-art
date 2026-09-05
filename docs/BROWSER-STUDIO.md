# Browser Studio

The recommended creation path is [agent chat and the CLI](AGENT-WORKFLOW.md). Browser Studio is the optional visual editor for importing agent projects, remixing, or generating with a provider API. It is the same editor used by the local server, backed by IndexedDB instead of repository files.

Open [pelicans.art/sprite-editor.html?mode=browser](https://pelicans.art/sprite-editor.html?mode=browser).

## Edit an agent project

Choose **Import agent project** and select the generated `output/project.json`. Unchanged dialogue keeps its recordings. Changed dialogue needs a configured voice source, or export the bundle and let your agent regenerate it with the CLI.

## Start without an API key

The first-run guide offers three credential-free paths:

- **Remix a sample** imports the bundled pelican skit, its characters, and its scenery into this browser.
- **Import from the Pouch** accepts a pelicans.art community link.
- **Start empty** opens the manual SVG and skit tools.

An API key is required only for **Create with AI** and later AI generation commands.

## Connect AI

The guided setup supports OpenAI, OpenRouter, and Anthropic. It offers a small model shortlist for each provider rather than the provider's complete catalog. Choose **Other model ID** under the model dropdown if you intentionally need an unlisted compatible model.

Model catalogs change. A model appearing in a provider's general catalog does not guarantee that it can accept image references or return the long structured SVG output the studio expects.

## Key handling

Provider keys are sent directly from this browser to the provider you select. They are not sent to the pelicans.art static site.

During setup you can choose:

- **Current browser session:** stored in `sessionStorage` and removed when the session ends.
- **Remember on this device:** stored in `localStorage` until you remove it.

Browser storage is convenient, not a hardware-backed secret vault. Do not use Browser Studio on an untrusted or shared device. Settings → Advanced → **Remove saved keys and tokens** clears provider credentials from both storage locations.

Project backups do not include provider keys.

## Voices

- **No voices (captions only)** is the default. The player turns captions on automatically whenever dialogue has no audio.
- **Cloud provider** connects OpenAI or ElevenLabs. Settings contains the connection, model, and provider-wide delivery controls—but no global voice picker.
- **Custom TTS** connects either a TTS app on the same computer or a server hosted elsewhere. Supported request formats are OpenAI-compatible, Hermes/Piper, generic JSON, and generic form-data.

Voice choice and testing live with the cast. Select a character and open **Voice Settings** in the right sidebar to set its default voice. Open a skit to see its character portraits, test each role's dialogue, and optionally override that character's default for only that skit. Each character and skit remembers separate choices for each source.

For custom TTS, add the server's optional voice-list URL to populate the character and skit dropdowns. Since custom APIs do not share a standard discovery endpoint, **Other voice ID or reference** remains available when no list is provided. A local browser connection requires the TTS app to allow this site's origin. The private local studio can relay localhost, tailnet, HTTP, and non-CORS services; a public static page needs a compatible HTTPS/CORS endpoint.

Configure your own speech endpoint for the Hermes/Piper preset. Its placeholder voice list is not a discovery of installed VPS models; provide a voice-list URL when your service supports one.

## Storage and backup

Characters, backgrounds, props, skits, published bundles, and imported voices are stored in IndexedDB for the current browser profile and site origin.

Use Settings → Data to:

- Export a JSON backup.
- Import a previous backup.
- Clear all browser projects.

Export a backup before clearing site data, switching browsers, or moving to another computer.

## Browser versus local server

| Capability | Browser Studio | Local server |
| --- | --- | --- |
| Manual SVG and skit editing | Yes | Yes |
| Direct OpenAI/OpenRouter/Anthropic generation | Yes | No; server generation uses its configured agent |
| IndexedDB project storage | Yes | No |
| Portable project backup | Yes | Files already live on disk |
| Caption-only, cloud, and configurable TTS | HTTPS+CORS endpoints directly | Private endpoints can use the local relay |
| Built-in custom voice processing | No | Yes |
| Repository asset development | No | Yes |
| Automated MP4 capture | No | Yes |

The editor currently targets desktop browsers. Watching skits remains available on phones.

## Troubleshooting

- **The AI key checks successfully but generation fails:** confirm the selected model supports text output, image input when using references, and sufficiently long responses.
- **A private TTS endpoint cannot be reached from pelicans.art:** use the private local studio relay, or expose the service through HTTPS with CORS configured for the site.
- **Projects disappeared:** verify that you are using the same browser profile and exact site origin. Restore an exported backup if available.
- **The editor says server mode:** open the URL with `?mode=browser` to force IndexedDB-backed Browser Studio.
