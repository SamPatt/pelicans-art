/**
 * Audio Manager for AI Improv Theater
 * Handles TTS generation and synchronized playback
 */

class AudioManager {
  constructor(options = {}) {
    this.ttsEndpoint = options.ttsEndpoint || '/tts/tts';
    this.audioCache = new Map(); // key -> { audio: Audio, duration: number, startTime: number }
    this.triggeredThisSession = new Set(); // Track what's been triggered to avoid re-triggering
    this.isGenerating = false;
    this.onProgress = options.onProgress || null;
    this.onReady = options.onReady || null;
    
    // Voice assignments for characters
    // Available: alba, marius, javert, jean, fantine, cosette, eponine, azelma
    this.voiceMap = {
      boss: 'fantine',
      employee: 'jean',      // switched from javert (too slow/drawn out)
      human: 'alba',         // neutral, snappy
      cat: 'cosette',
      default: 'alba'
    };
    
    // Volume normalization per voice (some voices are quieter)
    this.volumeMap = {
      fantine: 0.85,
      jean: 0.9,
      alba: 0.9,
      cosette: 1.0,    // boost cat voice
      default: 0.9
    };
  }
  
  getVoiceForCharacter(charId) {
    return this.voiceMap[charId] || this.voiceMap.default;
  }
  
  getVolumeForCharacter(charId) {
    const voice = this.getVoiceForCharacter(charId);
    return this.volumeMap[voice] || this.volumeMap.default;
  }
  
  async generateAudioForScript(script) {
    this.isGenerating = true;
    this.audioCache.clear();
    this.triggeredThisSession.clear();
    
    // Find all 'say' actions
    const sayActions = script.script.filter(beat => beat.do === 'say');
    const total = sayActions.length;
    let completed = 0;
    
    if (this.onProgress) {
      this.onProgress(0, total, 'Starting audio generation...');
    }
    
    for (const beat of sayActions) {
      const key = `${beat.t}-${beat.who}`;
      const voice = this.getVoiceForCharacter(beat.who);
      
      try {
        if (this.onProgress) {
          const preview = beat.line.length > 25 ? beat.line.substring(0, 25) + '...' : beat.line;
          this.onProgress(completed, total, `Generating: "${preview}"`);
        }
        
        const audioData = await this.generateTTS(beat.line, voice);
        const audio = new Audio();
        audio.src = URL.createObjectURL(audioData);
        
        // Small volume ramp to prevent clicks
        audio.volume = 0.9;
        
        // Wait for audio to load to get duration
        await new Promise((resolve, reject) => {
          audio.onloadedmetadata = resolve;
          audio.onerror = reject;
          // Timeout fallback
          setTimeout(resolve, 5000);
        });
        
        this.audioCache.set(key, {
          audio: audio,
          duration: audio.duration || beat.duration || 2,
          startTime: beat.t,
          line: beat.line,
          charId: beat.who,
          volume: this.getVolumeForCharacter(beat.who)
        });
        
        completed++;
        
      } catch (err) {
        console.error(`Failed to generate audio for "${beat.line}":`, err);
        completed++;
      }
    }
    
    this.isGenerating = false;
    
    if (this.onProgress) {
      this.onProgress(total, total, 'Audio generation complete!');
    }
    
    if (this.onReady) {
      this.onReady();
    }
    
    return this.audioCache;
  }
  
  async generateTTS(text, voice) {
    // Build URL with query params for TTS settings
    // Lower temperature = snappier, less drawn out
    const url = new URL(this.ttsEndpoint, window.location.origin);
    
    const formData = new FormData();
    formData.append('text', text);
    formData.append('voice_url', voice);
    
    const response = await fetch(this.ttsEndpoint, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`TTS request failed: ${response.status}`);
    }
    
    return await response.blob();
  }
  
  playAudioAt(time) {
    // Find audio that should start at this time
    for (const [key, data] of this.audioCache) {
      const diff = time - data.startTime;
      
      // Start audio if we're within the trigger window and haven't triggered it yet
      // Trigger window: 0 to 100ms after scheduled start
      if (diff >= 0 && diff < 0.1 && !this.triggeredThisSession.has(key)) {
        this.triggeredThisSession.add(key);
        
        // Stop ALL currently playing audio to prevent any overlap
        // This ensures clean transitions between any speakers
        for (const [otherKey, otherData] of this.audioCache) {
          if (otherKey !== key && !otherData.audio.paused) {
            // Fade out quickly instead of abrupt stop
            otherData.audio.volume = 0;
            setTimeout(() => {
              otherData.audio.pause();
              otherData.audio.volume = 0.9;
            }, 50);
          }
        }
        
        data.audio.currentTime = 0;
        data.audio.volume = data.volume;  // Apply per-character volume
        data.audio.play().catch(e => {
          console.warn('Audio play failed (user interaction needed?):', e);
        });
        
        console.log(`Playing audio at ${time.toFixed(2)}s (vol ${data.volume}): "${data.line.substring(0, 30)}..."`);
      }
    }
  }
  
  stopAll() {
    for (const [key, data] of this.audioCache) {
      data.audio.pause();
      data.audio.currentTime = 0;
    }
    this.triggeredThisSession.clear();
  }
  
  seekTo(time) {
    this.stopAll();
    // Mark everything before this time as already triggered
    for (const [key, data] of this.audioCache) {
      if (data.startTime < time) {
        this.triggeredThisSession.add(key);
      }
    }
  }
  
  // Reset for new playback from beginning
  resetTriggers() {
    this.triggeredThisSession.clear();
  }
}

window.AudioManager = AudioManager;
