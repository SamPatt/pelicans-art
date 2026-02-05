---
name: worker-status
description: Check the status of the pelicans-community Cloudflare Worker and R2 bucket
disable-model-invocation: true
allowed-tools: Bash, Read
argument-hint: [category]
---

Check the status of the pelicans-community Cloudflare Worker.

## Worker details
- **Name:** pelicans-community
- **URL:** https://pelicans-community.sam-cloudflare-d20.workers.dev
- **R2 Bucket:** pelicans-community
- **Source:** worker/community-worker.js
- **Config:** worker/wrangler.toml

## Steps

1. Check the worker is responding:
```bash
curl -s https://pelicans-community.sam-cloudflare-d20.workers.dev/api/community/characters | python3 -m json.tool
```

2. If an argument is provided, list that specific category:
```bash
curl -s "https://pelicans-community.sam-cloudflare-d20.workers.dev/api/community/$ARGUMENTS" | python3 -m json.tool
```

3. If no argument, list all six categories and summarize counts:
```bash
for cat in characters props backgrounds skits published voices; do
  echo "=== $cat ==="
  curl -s "https://pelicans-community.sam-cloudflare-d20.workers.dev/api/community/$cat" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{len(d[\"items\"])} items, hasMore: {d[\"hasMore\"]}')"
done
```

4. Report a summary: which categories have content, total item counts, whether the worker is healthy.

## Valid categories
characters, props, backgrounds, skits, published, voices
