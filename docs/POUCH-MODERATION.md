# Pouch report handling

Public guidance appears in the Pouch's “Sharing, reuse & reporting” panel and [asset licensing policy](../ASSET-LICENSE.md). Each asset detail includes a report link with its URL prefilled. GitHub's asset-report issue form is the normal public queue; private information and security reports belong in private communication with the owner, following [SECURITY.md](../SECURITY.md) for vulnerabilities.

Uploads are not premoderated. The maintainer reviews reports manually without a response-time promise. Rate limits reduce automated abuse; they do not establish ownership or replace review.

## Maintainer workflow

1. Record the asset URL, category and ID, report reason, and requested action. Do not repeat private evidence in public issues.
2. Review whether it is spam, unsafe content, a privacy concern, or a rights claim. For a disputed ownership claim, request supporting evidence privately if needed. An uploader name alone is not proof of ownership.
3. Remove confirmed unwanted material using the Worker's existing authenticated `DELETE /api/community/:category/:id` endpoint. Supply `ADMIN_KEY` through the existing private operator environment; never put it in an issue, committed file, or browser URL. The endpoint removes the asset's objects from the bucket.
4. Verify the API entry and files are unavailable and the gallery no longer lists it. Check associated static Watch pages or catalog entries and remove/redeploy them if they retain the removed content. Purge relevant CDN entries if cached copies remain; deletion cannot retract copies someone already downloaded.
5. Close the report with the outcome and brief reason, avoiding private details. If no action is taken, explain why and allow new evidence to be provided privately.

These rules provide a manual reporting/removal process, not an automated moderation system or a blanket license for uploads. Revisit capacity and stronger abuse controls if public traffic outgrows manual review.

## Upload controls

`worker/wrangler.toml` configures 30 upload attempts per minute per network address and 300 shared attempts per minute, across all asset categories. Cloudflare supplies the network address; caller-provided usernames and forwarded-address headers are not trusted as identity. Shared mobile or office networks may share this allowance. Requests over the limit receive HTTP 429 and `Retry-After: 60`; playback and downloads remain available.

These [Cloudflare rate limits](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) are approximate and local to each Cloudflare location, not a strict worldwide storage or spending cap. Request bodies are limited to 3 MB of bytes, including streamed uploads. Missing or failed rate-limit bindings stop uploads rather than bypassing protection.

For an incident, set `UPLOADS_ENABLED = "false"` in the Worker configuration and deploy; this pauses new uploads without disabling reads or administrator removal. Restore it after review. Monitor Worker HTTP 429/503 counts and R2 storage growth in Cloudflare; sustained distributed abuse calls for authenticated uploads or stronger centralized quotas.
