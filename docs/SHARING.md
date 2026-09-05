# Skit sharing and model provenance

Every committed skit and existing Pouch skit has a generated HTML watch page, with its title, description, canonical URL and available PNG thumbnail in the initial HTML. JavaScript is not required to read preview metadata. The page embeds the existing player with captions and includes native sharing with a clipboard/manual-copy fallback. Portrait skits keep a portrait player.

Run `node scripts/build-share-pages.mjs` to refresh the pages and `src/js/share-catalog.js`. GitHub Pages runs this during deployment. The generator reads only tracked bundles, plus every page of the public Pouch listing. Experimental untracked bundles are not published.

Pouch's play and copy-link actions use these short pelicans.art URLs. New uploads can be shared immediately through `/watch/:slug` on the existing community Worker hostname, without waiting for a site build. A later site deployment creates their short pelicans.art URLs. Direct player links also offer a Share skit button that copies the corresponding watch-page URL. Existing player URLs remain supported.

The domain's DNS is not in the current Cloudflare account, so no new custom domain is configured. Keep `workers_dev = true` to preserve the public Pouch API.

The Worker accepts an optional `model` string for all six categories: characters, props, backgrounds, scripts, published skits and voices. It stores that label in R2 metadata and exposes it in listing and detail responses. Missing or empty values display **Unknown**; no model is inferred for legacy assets. The editor's Pouch upload form provides a Model input. Browser-generated assets record the configured model automatically; metadata travels in sprite/prop/skit metadata and background SVG `data-model`. An explicit upload label overrides the saved label.

`worker/asset-metadata.js` holds explicit legacy corrections and captured preview image URLs. This updates public metadata and portable bundle responses without duplicating existing uploads or altering their audio. The Description's correction is based on the user's confirmed model attribution. Its model is GPT-6 Astra; its separately documented speech engine is Pocket TTS.

Preview images for the seven older Pouch skits are opening-frame screenshots of their actual playback, with captions and controls hidden. Future uploads without a supplied `meta.thumbnail` still receive title/description previews. For image previews, published bundles may set `meta.thumbnail` to an image under `https://pelicans.art/media/`.
