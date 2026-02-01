/**
 * AI Improv Theater - Skit Renderer v0.1
 * Parses JSON scripts and plays them on a canvas
 */

class SkitRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    
    // Playback state
    this.script = null;
    this.currentTime = 0;
    this.isPlaying = false;
    this.lastFrameTime = null;
    this.playbackSpeed = 1;
    
    // Runtime state
    this.characters = {};  // id -> { x, y, sprite, emotion, currentLine, lineEndTime }
    this.props = {};       // id -> { x, y, sprite, visible }
    
    // Colors for placeholder sprites
    this.colors = {
      man_suit: '#4a90d9',
      man_casual: '#5ba55b', 
      woman_casual: '#d94a8a',
      woman_business: '#9b59b6',
      robot: '#95a5a6',
      cat: '#f39c12',
      dog: '#e67e22',
      alien: '#1abc9c'
    };
    
    this.propColors = {
      coffee_mug: '#8b4513',
      laptop: '#2c3e50',
      briefcase: '#7f8c8d',
      plant: '#27ae60',
      mysterious_box: '#8e44ad',
      banana: '#f1c40f',
      sword: '#c0c0c0'
    };
    
    this.bgColors = {
      office: '#2c3e50',
      park: '#27ae60',
      kitchen: '#e8d5b7',
      space_station: '#1a1a2e',
      void: '#0a0a0a'
    };
    
    // Callbacks
    this.onTimeUpdate = options.onTimeUpdate || null;
    this.onEnd = options.onEnd || null;
  }
  
  load(script) {
    this.script = script;
    this.currentTime = 0;
    this.isPlaying = false;
    
    // Initialize characters at starting positions
    this.characters = {};
    for (const [id, char] of Object.entries(script.cast || {})) {
      this.characters[id] = {
        x: char.startPos[0],
        y: char.startPos[1],
        sprite: char.sprite,
        emotion: 'neutral',
        currentLine: null,
        lineEndTime: 0
      };
    }
    
    // Initialize props
    this.props = {};
    for (const [id, prop] of Object.entries(script.props || {})) {
      this.props[id] = {
        x: 0,
        y: 0,
        sprite: prop.sprite,
        visible: prop.visible || false
      };
    }
    
    this.render();
  }
  
  play() {
    if (!this.script) return;
    this.isPlaying = true;
    this.lastFrameTime = performance.now();
    this.tick();
  }
  
  pause() {
    this.isPlaying = false;
  }
  
  stop() {
    this.isPlaying = false;
    this.currentTime = 0;
    if (this.script) this.load(this.script);
  }
  
  seek(time) {
    this.currentTime = Math.max(0, Math.min(time, this.script?.meta?.duration || 0));
    // Rebuild state up to this point
    this.rebuildState();
    this.render();
  }
  
  rebuildState() {
    // Reset to initial state
    for (const [id, char] of Object.entries(this.script.cast || {})) {
      this.characters[id] = {
        x: char.startPos[0],
        y: char.startPos[1],
        sprite: char.sprite,
        emotion: 'neutral',
        currentLine: null,
        lineEndTime: 0
      };
    }
    
    for (const [id, prop] of Object.entries(this.script.props || {})) {
      this.props[id] = {
        x: 0,
        y: 0,
        sprite: prop.sprite,
        visible: prop.visible || false
      };
    }
    
    // Apply all completed actions
    for (const beat of this.script.script || []) {
      if (beat.t > this.currentTime) break;
      this.applyBeatInstant(beat);
    }
  }
  
  applyBeatInstant(beat) {
    const action = beat.do;
    
    switch (action) {
      case 'move':
      case 'enter':
      case 'exit':
        if (this.characters[beat.who]) {
          const endTime = beat.t + (beat.duration || 1);
          if (this.currentTime >= endTime) {
            // Movement complete
            if (action === 'move') {
              this.characters[beat.who].x = beat.to[0];
              this.characters[beat.who].y = beat.to[1];
            } else if (action === 'enter') {
              const targetX = beat.from === 'left' ? 150 : 650;
              this.characters[beat.who].x = targetX;
            } else if (action === 'exit') {
              const targetX = beat.to === 'left' ? -100 : 900;
              this.characters[beat.who].x = targetX;
            }
          }
        }
        break;
        
      case 'emote':
        if (this.characters[beat.who]) {
          this.characters[beat.who].emotion = beat.emotion;
        }
        break;
        
      case 'spawn':
        if (this.props[beat.what]) {
          this.props[beat.what].visible = true;
          this.props[beat.what].x = beat.at[0];
          this.props[beat.what].y = beat.at[1];
        }
        break;
        
      case 'despawn':
        if (this.props[beat.what]) {
          this.props[beat.what].visible = false;
        }
        break;
    }
  }
  
  tick() {
    if (!this.isPlaying) return;
    
    const now = performance.now();
    const delta = (now - this.lastFrameTime) / 1000 * this.playbackSpeed;
    this.lastFrameTime = now;
    
    this.currentTime += delta;
    
    if (this.onTimeUpdate) {
      this.onTimeUpdate(this.currentTime);
    }
    
    // Check if we've reached the end
    if (this.currentTime >= this.script.meta.duration) {
      this.currentTime = this.script.meta.duration;
      this.isPlaying = false;
      if (this.onEnd) this.onEnd();
    }
    
    this.update();
    this.render();
    
    if (this.isPlaying) {
      requestAnimationFrame(() => this.tick());
    }
  }
  
  update() {
    // Process all beats and update state
    for (const beat of this.script.script || []) {
      this.processBeat(beat);
    }
  }
  
  processBeat(beat) {
    const t = this.currentTime;
    const action = beat.do;
    
    switch (action) {
      case 'move':
        if (this.characters[beat.who]) {
          const startTime = beat.t;
          const endTime = beat.t + (beat.duration || 1);
          
          if (t >= startTime && t <= endTime) {
            // Interpolate position
            const progress = (t - startTime) / (endTime - startTime);
            const eased = this.easeInOut(progress);
            
            // Find starting position (need to look back)
            const startPos = this.getPositionBefore(beat.who, startTime);
            const endPos = beat.to;
            
            this.characters[beat.who].x = startPos[0] + (endPos[0] - startPos[0]) * eased;
            this.characters[beat.who].y = startPos[1] + (endPos[1] - startPos[1]) * eased;
          } else if (t > endTime) {
            this.characters[beat.who].x = beat.to[0];
            this.characters[beat.who].y = beat.to[1];
          }
        }
        break;
        
      case 'enter':
        if (this.characters[beat.who]) {
          const startTime = beat.t;
          const duration = beat.duration || 1.5;
          const endTime = startTime + duration;
          
          const startX = beat.from === 'left' ? -100 : 900;
          const endX = beat.from === 'left' ? 150 : 650;
          
          if (t >= startTime && t <= endTime) {
            const progress = this.easeInOut((t - startTime) / duration);
            this.characters[beat.who].x = startX + (endX - startX) * progress;
          } else if (t > endTime) {
            this.characters[beat.who].x = endX;
          }
        }
        break;
        
      case 'exit':
        if (this.characters[beat.who]) {
          const startTime = beat.t;
          const duration = beat.duration || 1.5;
          const endTime = startTime + duration;
          
          const endX = beat.to === 'left' ? -100 : 900;
          
          if (t >= startTime && t <= endTime) {
            const startPos = this.getPositionBefore(beat.who, startTime);
            const progress = this.easeInOut((t - startTime) / duration);
            this.characters[beat.who].x = startPos[0] + (endX - startPos[0]) * progress;
          } else if (t > endTime) {
            this.characters[beat.who].x = endX;
          }
        }
        break;
        
      case 'say':
        if (this.characters[beat.who]) {
          const startTime = beat.t;
          const endTime = beat.t + (beat.duration || 2);
          
          if (t >= startTime && t < endTime) {
            this.characters[beat.who].currentLine = beat.line;
            this.characters[beat.who].lineEndTime = endTime;
          } else if (t >= endTime && this.characters[beat.who].lineEndTime === endTime) {
            this.characters[beat.who].currentLine = null;
          }
        }
        break;
        
      case 'emote':
        if (this.characters[beat.who] && t >= beat.t) {
          this.characters[beat.who].emotion = beat.emotion;
        }
        break;
        
      case 'spawn':
        if (this.props[beat.what] && t >= beat.t) {
          this.props[beat.what].visible = true;
          this.props[beat.what].x = beat.at[0];
          this.props[beat.what].y = beat.at[1];
        }
        break;
        
      case 'despawn':
        if (this.props[beat.what] && t >= beat.t) {
          this.props[beat.what].visible = false;
        }
        break;
    }
  }
  
  getPositionBefore(charId, time) {
    const char = this.script.cast[charId];
    let pos = [...char.startPos];
    
    for (const beat of this.script.script) {
      if (beat.t >= time) break;
      if (beat.who !== charId) continue;
      
      if (beat.do === 'move') {
        pos = [...beat.to];
      } else if (beat.do === 'enter') {
        pos = [beat.from === 'left' ? 150 : 650, pos[1]];
      } else if (beat.do === 'exit') {
        pos = [beat.to === 'left' ? -100 : 900, pos[1]];
      }
    }
    
    return pos;
  }
  
  easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
  
  render() {
    const ctx = this.ctx;
    
    // Draw background
    const bgColor = this.bgColors[this.script?.stage?.background] || '#1a1a2e';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Draw floor line
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.moveTo(0, 380);
    ctx.lineTo(this.width, 380);
    ctx.stroke();
    
    // Draw props
    for (const [id, prop] of Object.entries(this.props)) {
      if (!prop.visible) continue;
      this.drawProp(prop, id);
    }
    
    // Draw characters (sorted by y for basic depth)
    const sortedChars = Object.entries(this.characters)
      .sort((a, b) => a[1].y - b[1].y);
    
    for (const [id, char] of sortedChars) {
      this.drawCharacter(char, id);
    }
  }
  
  drawCharacter(char, id) {
    const ctx = this.ctx;
    const x = char.x;
    const y = char.y;
    
    // Skip if offscreen
    if (x < -100 || x > 900) return;
    
    const color = this.colors[char.sprite] || '#888';
    
    // Body (rectangle)
    ctx.fillStyle = color;
    ctx.fillRect(x - 25, y - 80, 50, 80);
    
    // Head (circle)
    ctx.beginPath();
    ctx.arc(x, y - 100, 25, 0, Math.PI * 2);
    ctx.fill();
    
    // Emotion indicator
    ctx.fillStyle = '#fff';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    const emoticons = {
      neutral: '😐',
      happy: '😊',
      sad: '😢',
      angry: '😠',
      shocked: '😲',
      confused: '🤔',
      distressed: '😰'
    };
    ctx.fillText(emoticons[char.emotion] || '😐', x, y - 95);
    
    // Name label
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '12px Courier New';
    ctx.fillText(id.toUpperCase(), x, y + 15);
    
    // Speech bubble
    if (char.currentLine) {
      this.drawSpeechBubble(x, y - 140, char.currentLine);
    }
  }
  
  drawSpeechBubble(x, y, text) {
    const ctx = this.ctx;
    const maxWidth = 200;
    const padding = 10;
    const lineHeight = 18;
    
    ctx.font = '14px Courier New';
    
    // Word wrap
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      if (ctx.measureText(testLine).width > maxWidth - padding * 2) {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    
    // Calculate bubble size
    const bubbleWidth = Math.min(maxWidth, Math.max(...lines.map(l => ctx.measureText(l).width)) + padding * 2);
    const bubbleHeight = lines.length * lineHeight + padding * 2;
    
    // Position bubble (centered above character, clamped to screen)
    let bubbleX = x - bubbleWidth / 2;
    bubbleX = Math.max(10, Math.min(this.width - bubbleWidth - 10, bubbleX));
    const bubbleY = y - bubbleHeight;
    
    // Draw bubble background
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 8);
    ctx.fill();
    
    // Draw pointer
    ctx.beginPath();
    ctx.moveTo(x - 8, bubbleY + bubbleHeight);
    ctx.lineTo(x, bubbleY + bubbleHeight + 10);
    ctx.lineTo(x + 8, bubbleY + bubbleHeight);
    ctx.fill();
    
    // Draw text
    ctx.fillStyle = '#000';
    ctx.textAlign = 'left';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], bubbleX + padding, bubbleY + padding + 14 + i * lineHeight);
    }
  }
  
  drawProp(prop, id) {
    const ctx = this.ctx;
    const color = this.propColors[prop.sprite] || '#888';
    
    ctx.fillStyle = color;
    
    // Different shapes for different props
    if (prop.sprite === 'sword') {
      // Draw a sword shape
      ctx.fillRect(prop.x - 3, prop.y - 40, 6, 50);
      ctx.fillRect(prop.x - 15, prop.y, 30, 6);
    } else if (prop.sprite === 'banana') {
      // Draw a banana (curved rectangle-ish)
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 15, 0, Math.PI);
      ctx.fill();
    } else {
      // Default: small rectangle
      ctx.fillRect(prop.x - 15, prop.y - 15, 30, 30);
    }
    
    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(id, prop.x, prop.y + 25);
  }
}

// Export for use
window.SkitRenderer = SkitRenderer;
