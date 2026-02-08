# Feature: Negative Offset for Action Timing

## Problem Statement

Currently, actions in a skit execute sequentially - each action waits for the previous one to complete before starting. For dialogue (`say` actions), this means waiting for the entire audio clip to finish before the next action begins.

This creates unnaturally rigid timing. In real conversations and performances:
- People interrupt each other
- Actions overlap (someone starts moving while another is still talking)
- Reactions begin before a line finishes

There's no way to achieve these effects with the current sequential system.

## Proposed Solution

Add an **offset** property to actions that specifies how many seconds before the previous action ends this action should start.

Example: If Character A has a 4-second line, and Character B's response has `offset: -1.5`, Character B will start speaking 1.5 seconds before A finishes - creating an interruption effect.

---

## Design Decisions (Review Required)

### Decision 1: Audio Overlap Behavior

**Problem**: The current player explicitly stops any existing audio when a new speaker starts (lines 2234-2244, 2275-2278 in skit-player.html). There is also only one `currentSpeaker` variable and one `analyser` for lip sync.

**Options**:

A. **No true audio overlap (simpler)** - When the offset triggers, the previous audio is cut off. The "interruption" effect is achieved by cutting the first speaker short rather than both playing simultaneously. Lip sync transfers to the new speaker.
   - Pros: No refactoring of audio system needed
   - Cons: First speaker's audio cuts abruptly; not true overlap

B. **True audio overlap (more complex)** - Refactor to support multiple concurrent audio sources, each with their own gain node. Track per-speaker amplitude for lip sync.
   - Pros: Natural interruption where voices actually overlap
   - Cons: Significant refactoring; need to track multiple `currentSourceNode`s and multiple analysers or mix amplitudes

C. **Audio ducking (middle ground)** - Allow overlap but automatically lower the interrupted speaker's volume (duck) while the interrupter speaks.
   - Pros: Overlap exists but interrupter is clearly audible
   - Cons: Still requires multi-source support

**Recommendation**: Start with **Option A** for initial implementation. Document that "interruption" means the first speaker is cut off. This achieves the core goal (actions starting early) without audio system refactoring. Option B can be a follow-up enhancement.

### Decision 2: Non-Say Action Semantics

**Problem**: The current sequential mode does NOT wait for non-say actions to complete. When a `move` or `enter` action fires, the system immediately advances to the next beat (unless `delay` is set). This means offsets on non-say actions would behave inconsistently:
- Offset on a `say` action: starts X seconds before previous audio ends
- Offset on a `move` action following another `move`: would actually ADD delay since moves advance immediately

**Options**:

A. **Make non-say actions blocking** - Track when animations complete (via duration) and wait before advancing. Offsets then work consistently for all action types.
   - Pros: Consistent behavior; offsets mean the same thing everywhere
   - Cons: Changes existing behavior; animations that currently overlap would become sequential

B. **Only support offsets on actions following `say` or `pause`** - Offsets only apply when the previous action has a meaningful duration. Ignore/warn on other combinations.
   - Pros: No behavior change for existing skits; clear semantics
   - Cons: Limited flexibility; user might expect offsets to work everywhere

C. **Offsets only affect `say` actions** - Simplest scope: only allow offsets on `say` actions, and they only schedule relative to a previous `say` or `pause`.
   - Pros: Very limited scope; solves the main use case (dialogue interruption)
   - Cons: Can't do "start moving before line ends"

**Recommendation**: **Option B** - Only support offsets when the previous action is a `say`, `pause`, or `delay` (actions with meaningful duration). This solves the primary use case without changing existing behavior. Log a console warning if an offset is set but the previous action is instant.

### Decision 3: Scope - Sequential Mode Only

**Question from review**: Should offsets apply only in sequential mode (no `t`), and be ignored for timed beats?

**Answer**: Yes. Timed mode already has explicit timestamps (`t` property) that control when each beat fires. Offsets are redundant there - you'd just adjust the `t` values. Offsets only make sense in sequential mode where beats chain together.

Implementation: In `processNextSequentialBeat()`, only check offsets. The timed mode `animate()` loop ignores the `offset` property entirely.

### Decision 4: Delay Property Interaction

**Question from review**: Should `delay` be included in the "effective duration" for offset calculations?

**Answer**: No. The `delay` property is a post-action wait before advancing. Offset should be relative to when the action's *content* ends (audio/animation), not including artificial delays.

Example: If action A is a 3s audio clip with `delay: 1`, and action B has `offset: -0.5`:
- A's audio ends at 3s
- B starts at 2.5s (3s - 0.5s offset)
- The `delay: 1` is ignored for offset calculation (it would have made A "complete" at 4s, but we use content duration)

---

## User Experience

### In the Editor (sprite-editor.html)

1. Each action in the script list will have a new **timer button** (⏱️) next to the existing edit (✏️) and delete (✕) buttons

2. Clicking the timer button (or editing the action) reveals an offset input field:
   - Accepts negative values in seconds (e.g., -1.5, -2, -0.5)
   - Default is 0 (no offset, normal sequential behavior)
   - Clamped to reasonable range (e.g., -30 to 0)

3. Actions with offsets display a visual badge showing the offset value (e.g., `[-1.5s]`)

### In the Player (skit-player.html)

1. When a `say`, `pause`, or `delay` action starts, the system checks if the next action has a negative offset
2. If so, it schedules the next action to begin early (duration + offset seconds from now)
3. **For audio**: The previous speaker's audio is stopped when the new speaker starts (not true overlap - see Design Decision 1)
4. **For other actions** (move, emote, etc.): Offsets on the following action are ignored with a console warning (see Design Decision 2)

---

## Technical Requirements

### Data Model

Add optional `offset` property to action objects:

```javascript
// Normal action (no change)
{ do: "say", who: "alice", line: "Let me explain..." }

// Action with offset - starts 1.5s before previous ends
{ do: "say", who: "bob", line: "Wait, hold on!", offset: -1.5 }
```

### Duration Awareness

To schedule actions early, we need to know how long each action takes:

| Action Type | Duration Source |
|-------------|-----------------|
| `say` | `audio.duration` from cached audio buffer/element (with NaN guard) |
| `move` | `beat.duration` if set, else 1 second default |
| `enter` / `exit` | `beat.duration` if set, else 1.5 seconds default |
| `pause` | `beat.duration` property (required) |
| `prop-move` | `beat.duration` if set, else 1 second default |
| `prop-rotate` / `prop-scale` | `beat.duration` if set, else 0.5 seconds default |
| Instant actions (`emote`, `look`, `shot`, etc.) | 0 seconds |

**Important**: Always check `beat.duration` first before falling back to defaults. The current implementation may use `beat.duration` for some actions.

**Audio duration guard**: `HTMLAudioElement.duration` can be `NaN` until metadata loads, or `Infinity` for streams. When scheduling offsets, use `getActionDuration()` as fallback:
```javascript
const duration = Number.isFinite(cached.audio?.duration)
  ? cached.audio.duration
  : getActionDuration(beat);  // Falls back to beat.duration or default (2s for say)
```

### Scheduling Logic

Current flow:
```
Action A starts → Action A ends → Action B starts → Action B ends → ...
```

With negative offset (audio cut-off model):
```
Action A starts → [A.duration + B.offset] → Action B starts (A's audio stops)
                                                           → Action B ends → ...
```

---

## Implementation Details

### Files to Modify

#### 1. `src/sprite-editor.html`

**A. Add offset field to edit modal**

In `updateModalFields()` function, add a "Timing" section that appears for all action types:

```html
<div class="form-group timing-section">
  <label>Offset (seconds)</label>
  <input type="number" id="action-offset" value="0" step="0.5" min="-30" max="0">
  <small>Negative value = start before previous action ends</small>
</div>
```

**B. Add timer button to action row** (~line 2760-2762)

```html
<span class="actions">
  <button class="action-btn edit" onclick="openEditActionModal(${i})" title="Edit">✏️</button>
  <button class="action-btn offset" onclick="openEditActionModal(${i})" title="Timing">⏱️</button>
  <button class="action-btn delete" onclick="deleteScriptAction(${i})" title="Delete">✕</button>
</span>
```

**C. Save offset in `saveActionFromModal()`** (~line 3431)

```javascript
const offsetValue = parseFloat(document.getElementById('action-offset')?.value);
if (offsetValue < 0) {
  action.offset = offsetValue;
} else {
  // Explicitly remove offset if set to 0 or positive (clean up old values)
  delete action.offset;
}
```

**D. Load offset in `openEditActionModal()`** (~line 3224)

```javascript
if (document.getElementById('action-offset')) {
  document.getElementById('action-offset').value = action.offset || 0;
}
```

**E. Display offset badge in `renderSkitDetails()`** (~line 2700)

```javascript
if (action.offset) {
  content += ` <span class="offset-badge">[${action.offset}s]</span>`;
}
```

**F. Add CSS for offset badge**

```css
.offset-badge {
  background: #e94560;
  color: white;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 0.75em;
  margin-left: 5px;
}
```

#### 2. `src/skit-player.html`

**A. Add state variables - session token and Set for tracking**

```javascript
// Session token increments on each play(), allowing old timers to detect stale sessions
let playSessionId = 0;

// Track which beat indices we've already scheduled advancement for (within current session)
// Using a Set allows multiple overlapping offsets (beat 0 and beat 1 both scheduled early)
// This prevents double-triggering when onended fires after early scheduling
let scheduledAdvanceIndices = new Set();
```

**B. Add `getActionDuration()` function**

```javascript
function getActionDuration(beat) {
  // Check explicit duration first
  if (beat.duration !== undefined) {
    return beat.duration;
  }

  switch (beat.do) {
    case 'say':
      const sayActions = currentSkit.script.filter(b => b.do === 'say');
      const sayIdx = sayActions.indexOf(beat);
      const cacheKey = beat.t !== undefined ? `${beat.t}-${beat.who}` : `seq-${sayIdx}-${beat.who}`;
      const cached = audioCache.get(cacheKey);

      // AudioBuffer duration
      if (cached?.buffer && Number.isFinite(cached.buffer.duration)) {
        return cached.buffer.duration;
      }
      // HTMLAudioElement duration (with NaN/Infinity guard)
      if (cached?.audio && Number.isFinite(cached.audio.duration)) {
        return cached.audio.duration;
      }
      // Fallback
      return 2;

    case 'move':
    case 'prop-move':
      return 1;
    case 'enter':
    case 'exit':
      return 1.5;
    case 'pause':
      return beat.duration || 1;
    case 'prop-rotate':
    case 'prop-scale':
      return 0.5;
    default:
      return 0;  // Instant actions
  }
}

// Check if an action type has meaningful duration for offset purposes
function hasMeaningfulDuration(beat) {
  return beat.do === 'say' || beat.do === 'pause' || beat.do === 'delay';
}
```

**C. Modify `processNextSequentialBeat()`** (~line 2072)

```javascript
function processNextSequentialBeat() {
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  if (!isPlaying || sequentialIndex >= currentSkit.script.length) {
    if (sequentialIndex >= currentSkit.script.length) {
      stop();
    }
    return;
  }

  const beatIndex = sequentialIndex;  // Capture current index for closure
  const sessionId = playSessionId;    // Capture session for stale timer detection
  const beat = currentSkit.script[sequentialIndex];
  const prevBeat = sequentialIndex > 0 ? currentSkit.script[sequentialIndex - 1] : null;
  const nextBeat = currentSkit.script[sequentialIndex + 1];
  sequentialIndex++;

  // Helper to check if this timer is still valid
  const isStaleSession = () => sessionId !== playSessionId;

  // Warn if this beat has offset but previous beat doesn't support it
  if (beat.offset < 0 && prevBeat && !hasMeaningfulDuration(prevBeat)) {
    console.warn(`Offset on beat ${beatIndex} ignored: previous action '${prevBeat.do}' has no meaningful duration`);
  }

  // Handle delay/pause beats - WITH offset scheduling support
  if (beat.do === 'pause' || beat.do === 'delay') {
    const duration = beat.duration || beat.delay || 1;
    const durationMs = duration * 1000;

    // Check if next beat needs early scheduling
    if (nextBeat?.offset < 0) {
      const triggerTime = Math.max(0, duration + nextBeat.offset) * 1000;
      scheduledAdvanceIndices.add(beatIndex);
      setTimeout(() => {
        if (isStaleSession()) return;
        processNextSequentialBeat();
      }, triggerTime);
    }

    // Normal completion after full duration
    setTimeout(() => {
      if (isStaleSession()) return;
      if (!scheduledAdvanceIndices.has(beatIndex)) {
        processNextSequentialBeat();
      }
    }, durationMs);
    return;
  }

  // Process the beat with completion callback
  processBeat(beat, () => {
    // Only advance if we haven't already scheduled early for this beat
    if (isStaleSession()) return;
    if (!scheduledAdvanceIndices.has(beatIndex)) {
      processNextSequentialBeat();
    }
  });

  // For non-say beats: advance immediately (existing behavior)
  // Offsets are handled when the PREVIOUS beat starts, not here
  if (beat.do !== 'say') {
    const delay = (beat.delay || 0) * 1000;
    setTimeout(() => {
      if (isStaleSession()) return;
      if (!scheduledAdvanceIndices.has(beatIndex)) {
        processNextSequentialBeat();
      }
    }, delay);
  }
  // For 'say' beats, offset scheduling for NEXT beat happens in processBeat
}
```

**D. Modify `processBeat()` for 'say' actions** (~line 2280)

After setting up the audio source, add offset scheduling for the NEXT beat. Use `getActionDuration()` as fallback when audio duration isn't available.

**Important**: Only schedule offsets in sequential mode. The timed mode `animate()` loop also calls `processBeat()`, and offset scheduling would interfere with timestamp-based playback.

```javascript
if (cached.buffer) {
  const sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = cached.buffer;
  // ... existing gain/analyser setup ...

  // Check if next beat needs early scheduling (SEQUENTIAL MODE ONLY)
  if (sequentialMode) {
    const nextBeat = currentSkit.script[sequentialIndex];
    if (nextBeat?.offset < 0) {
      // Use audio duration if available, otherwise fall back to getActionDuration()
      const duration = Number.isFinite(cached.buffer.duration)
        ? cached.buffer.duration
        : getActionDuration(beat);
      const triggerTime = Math.max(0, duration + nextBeat.offset) * 1000;
      // Mark that we're scheduling advance for the current beat's index
      // (sequentialIndex has already been incremented, so current beat is sequentialIndex - 1)
      const currentBeatIndex = sequentialIndex - 1;
      const sessionId = playSessionId;  // Capture for stale detection
      scheduledAdvanceIndices.add(currentBeatIndex);
      setTimeout(() => {
        if (sessionId !== playSessionId) return;  // Stale session check
        processNextSequentialBeat();
      }, triggerTime);
    }
  }

  sourceNode.onended = onAudioEnd;
  sourceNode.start(0);
  currentSourceNode = sourceNode;
}
```

For `cached.audio` (HTMLAudioElement) branch, similar logic with fallback:

```javascript
if (cached.audio) {
  // Check if next beat needs early scheduling (SEQUENTIAL MODE ONLY)
  if (sequentialMode) {
    const nextBeat = currentSkit.script[sequentialIndex];
    if (nextBeat?.offset < 0) {
      // Use audio duration if available, otherwise fall back to getActionDuration()
      const duration = Number.isFinite(cached.audio.duration)
        ? cached.audio.duration
        : getActionDuration(beat);
      const triggerTime = Math.max(0, duration + nextBeat.offset) * 1000;
      const currentBeatIndex = sequentialIndex - 1;
      const sessionId = playSessionId;  // Capture for stale detection
      scheduledAdvanceIndices.add(currentBeatIndex);
      setTimeout(() => {
        if (sessionId !== playSessionId) return;  // Stale session check
        processNextSequentialBeat();
      }, triggerTime);
    }
  }

  cached.audio.onended = onAudioEnd;
  cached.audio.currentTime = 0;
  cached.audio.play().catch(e => {
    console.warn('Audio play failed:', e);
    onAudioEnd();
  });
}
```

**E. Reset state on stop/play**

In the `stop()` function:
```javascript
scheduledAdvanceIndices.clear();
// Note: playSessionId is NOT incremented here - stop() doesn't start a new session
```

In the `play()` function (before starting):
```javascript
playSessionId++;  // Invalidate any pending timers from previous session
scheduledAdvanceIndices.clear();
```

The session ID increment ensures that any `setTimeout` callbacks from a previous play session will detect they're stale (via `sessionId !== playSessionId` check) and exit early, even if they fire after a new session has started.

---

## Testing Plan

### Basic Functionality
1. Create action with no offset - verify normal sequential behavior unchanged
2. Create action with -1s offset - verify it starts 1 second before previous audio ends
3. Create action with offset larger than previous duration - verify it clamps to immediate start (0)

### Audio Behavior (Cut-off Model)
1. Two `say` actions where second has -2s offset
2. Verify first speaker's audio stops when second speaker starts
3. Verify lip sync transfers to new speaker correctly
4. Verify captions update correctly

### Mixed Action Types
1. `say` action followed by `move` with -0.5s offset - character starts moving before audio ends
2. `say` action followed by another `say` with -1s offset - interruption effect
3. `pause` (2s) followed by `say` with -0.5s offset - line starts at 1.5s into pause
4. `pause` (1s) followed by `say` with -2s offset - clamps to 0, line starts immediately

### Edge Cases
1. First action in script has offset (should be ignored - no previous action)
2. Offset on action following instant action (e.g., `emote`) - should log warning to console, offset ignored
3. Chain of 3+ `say` actions with offsets - verify timing cascades correctly (tests Set-based tracking)
4. Chained offsets where beat 1 starts before beat 0 ends, and beat 2 has offset from beat 1 - verify no double-triggers

### State Management
1. **Stop during overlap timer**: Start playback, let offset timer be scheduled, hit stop, then play again - verify old timer doesn't advance new session (session ID check)
2. **Restart during playback**: Rapid stop/play cycles - verify no cross-session contamination
3. **Old timer fires after restart**: Start skit with 5s audio and -1s offset, stop at 3s, immediately play again - the old 4s timer will fire during new session but should be ignored

### Editor
1. Set offset to -2, save, reload - verify offset persists
2. Set offset to -2, then change to 0, save - verify offset is removed from saved data (not just set to 0)
3. Set offset to positive value - verify it's treated as 0/ignored

### Audio Duration Edge Cases
1. Audio where `duration` is initially `NaN` (not yet loaded) - verify scheduling doesn't produce invalid timeout
2. Very short audio clips (< 1s) with offset larger than duration - verify clamp to 0

---

## Future Enhancements

1. **True audio overlap (Option B)**: Refactor audio system to support multiple concurrent sources with per-speaker lip sync
2. **Audio ducking**: Lower interrupted speaker's volume automatically
3. **Visual timeline**: Show overlapping actions in a timeline view in the editor
4. **Waveform preview**: Show audio duration visually to help users pick appropriate offset values
5. **Positive offsets**: Add explicit delay after previous action (partially overlaps with existing `delay` property)

---

## Appendix: Current Code References

- Audio stopping on new speaker: `skit-player.html` lines 2234-2244, 2275-2278
- Sequential beat processing: `skit-player.html` line 2072 (`processNextSequentialBeat`)
- Non-say immediate advance: `skit-player.html` lines 2108-2112
- Say action audio setup: `skit-player.html` lines 2280-2303
- Lip sync analyser: `skit-player.html` line 2137 (single `analyser` and `currentSpeaker`)
