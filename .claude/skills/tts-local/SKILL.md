---
name: tts-local
description: Manage the local pocket-tts server (start, stop, status, test)
disable-model-invocation: true
allowed-tools: Bash, Read
argument-hint: [start|stop|status|test]
---

Manage the local pocket-tts text-to-speech server.

## Server details
- **Binary:** pocket-tts (installed at ~/.local/bin/pocket-tts)
- **Port:** 8000
- **Host:** 0.0.0.0
- **Web UI:** http://localhost:8000
- **API:** POST /tts with FormData (text, voice_url)
- **Voices:** alba, marius, javert, jean, fantine, cosette, eponine, azelma

## Commands

### status (default)
Check if the server is running:
```bash
if pgrep -f "pocket-tts serve" > /dev/null; then
  echo "pocket-tts is RUNNING (PID: $(pgrep -f 'pocket-tts serve'))"
  curl -s http://localhost:8000/ > /dev/null && echo "Web UI responding at http://localhost:8000"
else
  echo "pocket-tts is NOT RUNNING"
fi
```

### start
Start the server in the background:
```bash
if pgrep -f "pocket-tts serve" > /dev/null; then
  echo "pocket-tts is already running (PID: $(pgrep -f 'pocket-tts serve'))"
else
  nohup pocket-tts serve --port 8000 --host 0.0.0.0 > /tmp/pocket-tts.log 2>&1 &
  sleep 3
  if pgrep -f "pocket-tts serve" > /dev/null; then
    echo "pocket-tts started (PID: $(pgrep -f 'pocket-tts serve'))"
    echo "Web UI: http://localhost:8000"
    echo "Logs: /tmp/pocket-tts.log"
  else
    echo "Failed to start. Check /tmp/pocket-tts.log"
    tail -20 /tmp/pocket-tts.log
  fi
fi
```

### stop
Stop the server:
```bash
if pgrep -f "pocket-tts serve" > /dev/null; then
  pkill -f "pocket-tts serve"
  sleep 1
  echo "pocket-tts stopped"
else
  echo "pocket-tts is not running"
fi
```

### test
Generate a test audio file:
```bash
if ! pgrep -f "pocket-tts serve" > /dev/null; then
  echo "pocket-tts is not running. Start it first with: /tts-local start"
  exit 1
fi
curl -s -X POST http://localhost:8000/tts \
  -F "text=Hello, this is a test of the pocket TTS system." \
  -F "voice_url=alba" \
  -o /tmp/tts-test.wav
if [ -f /tmp/tts-test.wav ]; then
  file /tmp/tts-test.wav
  ls -lh /tmp/tts-test.wav
  echo "Test audio saved to /tmp/tts-test.wav"
  echo "Play with: aplay /tmp/tts-test.wav"
else
  echo "Failed to generate audio"
fi
```

## Steps

1. Parse the argument (default to "status" if none provided)
2. Run the appropriate command based on argument
3. Report the result to the user
