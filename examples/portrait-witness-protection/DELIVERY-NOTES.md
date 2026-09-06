# Witness Perk-tection

New portrait CLI test: 720×1280, 25.734 seconds, H.264/AAC; 8/8 dialogue lines captured and muxed. Opening, middle, and end frames visually inspected. Audio was checked for decoding, timing, and line coverage; no listening review was available. Second render reused all eight recordings after enlarging the actors for phone readability.

Artwork/script: GPT-6 Astra. Pelican and barista reused; portrait café background newly authored. Speech: local pinned Pocket 2.1.0 April English; customer=paul, barista=anna. Runtime: SamPatt/pelicans-art, commit 79ef5e785427c238b64a105034823b78b0b70a9d. Build manifest records workingTreeDirty=true; preserve that provenance.

Open output/project.json in the Editor for the self-contained project. Source project.json keeps the exact speech profile; its loopback endpoint must point to a matching service on another machine before changing dialogue. Run node scripts/theater.mjs render <project-directory> to rerender. No installer or public routing changes were needed.
