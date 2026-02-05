---
name: worker-deploy
description: Deploy the pelicans-community Cloudflare Worker after code changes
disable-model-invocation: true
allowed-tools: Bash, Read
---

Deploy the pelicans-community Cloudflare Worker to Cloudflare.

## Worker details
- **Name:** pelicans-community
- **URL:** https://pelicans-community.sam-cloudflare-d20.workers.dev
- **R2 Bucket:** pelicans-community
- **Source:** worker/community-worker.js
- **Config:** worker/wrangler.toml
- **Working directory:** worker/

## Steps

1. Verify wrangler auth:
```bash
npx wrangler whoami
```

2. Deploy from the worker directory:
```bash
cd /home/nondescript/code_repos/sampatt/ai-improv-theater/worker && npx wrangler deploy
```

3. Verify the deployment by hitting the health check:
```bash
curl -s https://pelicans-community.sam-cloudflare-d20.workers.dev/api/community/characters | python3 -m json.tool
```

4. Report the new Version ID and confirm the worker is responding.

## Updating the frontend URL

If the worker URL changes after deployment, update the `COMMUNITY_API_URL` constant in `src/sprite-editor.html`:
```javascript
const COMMUNITY_API_URL = 'https://pelicans-community.sam-cloudflare-d20.workers.dev/api/community';
```

## R2 bucket management

If the R2 bucket needs to be recreated:
```bash
npx wrangler r2 bucket create pelicans-community
```

List existing buckets:
```bash
npx wrangler r2 bucket list
```
