# Security

The Node.js authoring server is for a single trusted operator. It can write and delete local assets, relay speech requests, and use configured integration credentials. It binds to loopback by default. Use an SSH tunnel or an authenticated private reverse proxy for VPS access; it is not an authenticated multi-user public service.

Browser requests must come from the server's own origin or an exact origin configured in `CORS_ORIGIN`. For a private HTTPS reverse proxy, configure its external origin explicitly. Origin checks are not user authentication and do not replace network access controls.

Never commit `.env` files, API keys, systemd credentials, private voice recordings, or diagnostic captures that may contain them. The retained legacy Studio can optionally remember provider keys in local storage; use that option only on a trusted device. The companion Editor has no model-provider key configuration.

The community Pouch Worker is a separate service. Its current unauthenticated upload endpoint still needs abuse controls and ownership/moderation work before unrestricted promotion.

Report suspected vulnerabilities through GitHub's private vulnerability reporting if enabled, or contact the repository owner privately. Do not post credentials or exploit details in a public issue.
