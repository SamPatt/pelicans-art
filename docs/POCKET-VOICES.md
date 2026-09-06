# Pocket voice sources

The Editor dropdown exposes the 26 presets in our pinned April English catalog, including javert. `scripts/theater/pocket-voices.json` is the source; skill packaging copies it to `src/pocket-voices.json` for the public Editor. A connected server can provide its own available preset list. Existing voice selections are retained.

For more voices, start with [Kyutai’s voice library](https://huggingface.co/kyutai/tts-voices), which links downloadable audition samples and describes their sources. The voice-donations collection is CC0; VCTK and Alba MacKenna recordings use attribution licenses; Expresso and EARS have non-commercial restrictions. These are source-specific terms, not one blanket license for the library.

The library includes audio references and embeddings for different Kyutai models. They are not interchangeable with our pinned Pocket April preset files. Keep the current preset-only checkpoint as the default. To add a voice beyond its shipped catalog, first audition it with a compatible Pocket model, establish its source/license, then pin the repository revision, file and checksum and test fresh setup and synthesis. Do not silently substitute a cloning checkpoint or replace an existing selection.

[Pocket’s documentation](https://kyutai-labs.github.io/pocket-tts/) describes voice conditioning and export. Custom audio conditioning requires the voice-cloning-capable path, which is separate from the currently installed preset-only workflow.
