# Standalone SVG artwork

Use this path when the user wants a character, prop, background, illustration, or visual variants without a full skit. The current agent authors the SVG directly; the CLI does not generate it through another model. Do not invent dialogue, start TTS, or render an MP4 for an artwork-only request.

Use an existing runtime checkout. If preview dependencies are missing, follow the installation reference with `setup --check --svg`, then `setup --svg`. This needs Node/npm and Chromium, but not Python, FFmpeg, a speech service, or the authoring server. Host browser libraries still require the explicit permission described in installation. Do not run the speech doctor for this path.

Write the requested SVG into a new source file. Use a valid SVG namespace and a finite positive viewBox. Keep artwork self-contained and static: no scripts, event handlers, external fonts/images, CSS imports/escapes, or animation elements. Paths, gradients, masks, clipping, local references, and embedded raster images are supported. For an animated-theater character, read the character structure in `references/authoring.md` and the runtime's `docs/SPRITE-GUIDE.md`; include its required body/head/eye/mouth IDs. An ordinary illustration does not require character IDs.

```sh
node scripts/theater.mjs svg data/artwork/pelican-v1 \
  --source /path/to/pelican.svg \
  --kind character \
  --title "Pelican stage manager" \
  --model "actual generation model"
```

Choose `--kind artwork` (the default), `character`, `background`, or `prop`. Model defaults to `Unknown` when it cannot be identified. Each output directory must be new; revisions and alternative designs get new directories so earlier deliveries remain intact.

The command validates the SVG and produces:

- `asset.svg`: the exact editable artwork.
- `preview.png`: a transparent PNG with the full viewBox, longest edge 1024 pixels.
- `manifest.json`: title, kind, model, runtime revision, relative filenames, MIME types, sizes, and SHA-256 hashes.

The success JSON returns absolute `svg`, `preview`, and `manifest` paths for attachment tools. Inspect the PNG before delivery for clipping, blank artwork, and legibility. Return the PNG inline using the current chat's image mechanism and attach the original SVG for editing. Include the manifest when useful for provenance. A filesystem path on a VPS does not deliver an image to a mobile user. Use the chat's native attachment mechanism or an existing authorized private preview; never publish or open a port merely to obtain a link. Retain files and explain if this chat cannot transfer them.

After delivery, ask what the user would like to change. Offer a skit only if relevant; do not automatically produce one. To reuse the artwork later, copy the delivered SVG into the skit project's `assets/` directory and carry its model into asset metadata. The standalone delivery is not a skit bundle and should not be passed to the Editor's Open project action.
