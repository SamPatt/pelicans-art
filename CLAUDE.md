# AI Improv Theater - Claude Instructions

## VPS Deployment

This project runs on a VPS at `65.108.53.114`. The production deployment is managed by the OpenClaw bot (Hist).

### SSH Access

```bash
ssh root@65.108.53.114
```

Then switch to the openclaw user:
```bash
su - openclaw
```

### Project Location on VPS

```
/home/openclaw/.openclaw/workspace/projects/ai-improv-theater/
```

### Running Services

| Service | Port | Access | Description |
|---------|------|--------|-------------|
| HTTP Server | 8080 | Public | Serves the frontend from `src/` |
| Pocket TTS | 8001 | Tailscale | Text-to-speech server |

**Access URLs:**
- Frontend: `http://65.108.53.114:8080`
- TTS API (via Tailscale): `http://100.76.176.67:8001`

### Syncing Code

Both local and VPS have access to the same GitHub repo: `https://github.com/HistorAI/ai-improv-theater.git`

Always use git for code changes:

**Local (push changes):**
```bash
git add -A && git commit -m "message" && git push
```

**VPS (pull changes):**
```bash
ssh root@65.108.53.114 "cd /home/openclaw/.openclaw/workspace/projects/ai-improv-theater && sudo -u openclaw git pull"
```

Do NOT use rsync or scp for code sync.

### Restarting Services

The HTTP server and pocket-tts are running as background processes. To restart them:

```bash
# SSH to VPS and switch to openclaw user
ssh root@65.108.53.114
su - openclaw

# Find and kill existing processes
pkill -f "http.server 8080"
pkill -f "pocket-tts serve"

# Restart HTTP server (from src directory)
cd /home/openclaw/.openclaw/workspace/projects/ai-improv-theater/src
nohup python3 -m http.server 8080 &

# Restart TTS server (bound to all interfaces for Tailscale access)
cd /home/openclaw/.openclaw/workspace/projects/ai-improv-theater
source venv/bin/activate
nohup pocket-tts serve --port 8001 --host 0.0.0.0 &
```

### File Structure

```
ai-improv-theater/
├── src/                  # Frontend (HTML, JS, CSS)
│   ├── index.html        # Main page
│   ├── renderer.js       # Canvas-based skit renderer
│   └── skits/            # JSON skit files
├── server/               # Backend services
├── sprites/              # Character and prop images
├── voice-samples/        # Reference audio for voice cloning
├── scripts/              # Utility scripts
└── venv/                 # Python virtualenv (TTS dependencies)
```

### TTS API

The pocket-tts server is accessible via Tailscale at `http://100.76.176.67:8001`:

```bash
# Generate speech (returns WAV audio)
curl -X POST http://100.76.176.67:8001/tts -F "text=Hello world" -o output.wav

# With voice cloning via URL
curl -X POST http://100.76.176.67:8001/tts \
  -F "text=Hello world" \
  -F "voice_url=https://example.com/voice.wav" \
  -o output.wav
```

API docs available at: `http://100.76.176.67:8001/docs`

### Workspace Directory

The OpenClaw bot has a workspace at `/home/openclaw/.openclaw/workspace/` where files can be shared. Data files (like JSON datasets) can be placed there for the bot to access.
