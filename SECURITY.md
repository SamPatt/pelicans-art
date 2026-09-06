# Security

The Node.js authoring server is for a single trusted operator. It can write and delete local assets, relay speech requests, and use configured integration credentials. It binds to loopback by default. Use an SSH tunnel or an authenticated private reverse proxy for VPS access; it is not an authenticated multi-user public service.

Browser requests must come from the server's own origin or an exact origin configured in `CORS_ORIGIN`. For a private HTTPS reverse proxy, configure its external origin explicitly. Origin checks are not user authentication and do not replace network access controls.

Never commit `.env` files, API keys, systemd credentials, private voice recordings, or diagnostic captures that may contain them. The retained legacy Studio can optionally remember provider keys in local storage; use that option only on a trusted device. The companion Editor has no model-provider key configuration.

The community Pouch Worker is a separate service. Its anonymous upload endpoint has per-network and shared upload throttles, a 3 MB streaming body limit, and a fail-closed upload pause. SVG delivery is sandboxed. Rate limits are approximate and per Cloudflare location, not a global quota. See [Pouch moderation](docs/POUCH-MODERATION.md) for reporting, authenticated administrator removal, and operational limits. Upload names are not verified identities.

Report suspected vulnerabilities through [GitHub’s private vulnerability reporting](https://github.com/SamPatt/pelicans-art/security/advisories/new), which is enabled, or contact the repository owner privately. Do not post credentials or exploit details in a public issue.
