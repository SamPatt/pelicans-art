# Voice auditions and agent casting

Public sampler: https://pelicans.art/voices.html

The sampler covers all 26 presets in `scripts/theater/pocket-voices.json`. It uses static recordings from the pinned Pocket 2.1.0 April English profile. `src/voice-samples.json` records the exact synthesis profile, embedding revision, shared audition text, audio URLs, durations, and file hashes. Samples are loudness normalized; pitch and tempo are unchanged. Regenerate using `python3 scripts/build-voice-sampler.py` with the matching local service already running at 127.0.0.1:8001. The script rejects a mismatched profile or voice list.

## Taking choices back to an agent

Users can label any preset and assign a character in the sampler, then copy their choices into agent chat. The handoff retains canonical preset IDs: a label like “dry narrator” does not replace `jean` in a project's cast configuration. Users can also download/import their notes as `pelican-voice-labels.json`. Notes are local to that browser until shared; they do not change the global catalog or other visitors' labels.

Agents should resolve the supplied IDs against the selected speech endpoint's available presets. If one is unavailable, explain that and offer an audition of available alternatives; do not silently remap IDs. Descriptions are subjective audition notes. Offer a short reading of the actual character dialogue before generating the entire skit. Existing recordings remain unchanged unless the user requests revision.

## Proposed pre-skit questions

Keep this conversational: ask only what the user hasn't already specified, ideally in one short message. This is a proposed intake for review, not a new mandatory installer questionnaire.

1. What's the premise? If undecided, offer two absurd ideas.
2. Portrait or landscape? Suggest portrait for phone feeds and landscape for a wider stage.
3. Roughly how long, and what tone? Default to a 30–60 second absurd comedy if the user asks the agent to choose. Respect any audience/content boundaries supplied.
4. Voice casting: use the user's sampler choices, accept descriptions of the roles, or offer two short auditions per main character. “Choose for me” is fine.

Reflect the choices in a compact plot/dialogue proposal before a full render, unless the user already authorized direct creation. Avoid repeatedly asking about decisions already made. For standalone SVG requests, skip video format, duration, and voices entirely.
