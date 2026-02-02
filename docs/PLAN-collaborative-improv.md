# Collaborative AI Improv - Development Plan

## Vision

Multiple AI agents collaborate in a "writers' room" to create sketch comedy, with their creative process visible to human audiences in real-time. Once the script is ready, it renders as an animated skit.

**Key insight:** The collaboration IS the show. Watching AIs riff, disagree, build on each other's ideas, and land on something funny together is compelling content — not just the final skit.

---

## Phase 1: Comedy Research & Skill Development

### Goal
Build a foundation of comedy knowledge that agents can reference.

### Tasks

1. **Research sketch comedy structure**
   - UCB/iO improv principles (yes-and, heightening, game of the scene)
   - Classic sketch structures (premise, escalation, blow/button)
   - What makes absurdist comedy work
   - Timing, callbacks, rule of threes

2. **Study existing sketch shows**
   - SNL, Key & Peele, I Think You Should Leave, Monty Python
   - What patterns emerge?
   - How do premises get "found" and heightened?

3. **Create comedy reference doc**
   - `docs/COMEDY-GUIDE.md` — principles agents can be prompted with
   - Examples of good sketch structure
   - Common pitfalls (too random, no escalation, explaining the joke)

4. **Draft agent personas/roles**
   - "The Pitch Person" — proposes premises
   - "The Yes-And-er" — builds and heightens
   - "The Editor" — identifies what's not working
   - "The Callback King" — finds connections and payoffs

### Deliverable
`COMEDY-GUIDE.md` + initial agent role definitions

---

## Phase 2: Writers' Room Architecture

### Goal
Multi-agent collaboration system that produces scripts.

### Components

1. **Room Coordinator**
   - Creates a "room" with a premise/prompt
   - Assigns agent roles
   - Manages turn-taking or free-form phases
   - Knows when script is "done"

2. **Agent Communication**
   - Agents see full conversation history
   - Can propose beats, react to others, suggest edits
   - Final output: structured script JSON

3. **Collaboration Phases**
   ```
   [PREMISE] → [PITCH] → [BUILD] → [STRUCTURE] → [SCRIPT] → [REFINE]
   ```
   - PREMISE: Given by human or generated
   - PITCH: Agents throw out initial ideas
   - BUILD: Yes-and, find the "game"
   - STRUCTURE: Agree on arc, characters, beats
   - SCRIPT: Write actual dialogue
   - REFINE: Polish, add callbacks, tighten

4. **Output Format**
   - Matches existing skit JSON schema
   - Ready to hand off to skit-player-v2

### Technical Options

**Option A: OpenClaw Sessions**
- Use `sessions_spawn` for each agent
- Coordinator sends messages between them
- Pros: Already have this, agents are isolated
- Cons: Latency between turns, orchestration complexity

**Option B: Single Context Multi-Persona**
- One model plays all roles with clear delineation
- Pros: Fast, simple, good for prototyping
- Cons: Less "authentic" multi-agent, harder to scale

**Option C: External Framework**
- AutoGen, CrewAI, or custom
- Pros: Built for this
- Cons: Another dependency, learning curve

**Recommendation:** Start with **Option B** for prototyping, migrate to **Option A** once the format is proven.

### Deliverable
Working prototype that takes a premise → outputs a script JSON

---

## Phase 3: Writers' Room UI

### Goal
Real-time visibility into the creative process.

### Features

1. **Live Chat View**
   - Shows agent messages as they happen
   - Agent avatars/names
   - Timestamps or phase indicators

2. **Visual Differentiation**
   - Color-code by agent or role
   - Highlight when they're "writing" vs "discussing"
   - Show drafts/revisions

3. **Script Preview Panel**
   - As script takes shape, show it building
   - Beats appear as they're agreed on

4. **Human Interaction (Phase 3b)**
   - Thumbs up/down on ideas
   - Laugh/emoji reactions
   - Inject suggestions ("what if the waiter is a leprechaun?")
   - Vote on which direction to go

### Layout Concept
```
┌─────────────────────────────────────────────────────────┐
│  [Writers' Room]                         [Script Draft] │
│  ┌─────────────────────────┐  ┌───────────────────────┐ │
│  │ 🎭 Pitch: "What if..."  │  │ SCENE: Restaurant     │ │
│  │ 🎪 Build: "Yes! And..." │  │ CAST: waiter, patron  │ │
│  │ ✂️ Edit: "Maybe cut..." │  │ ─────────────────     │ │
│  │ 🎭 Pitch: "Callback to" │  │ Beat 1: waiter enters │ │
│  │ ...                     │  │ Beat 2: ...           │ │
│  └─────────────────────────┘  └───────────────────────┘ │
│  [💬 Your suggestion...]  [👍] [👎] [😂]                │
├─────────────────────────────────────────────────────────┤
│                    [▶ Watch Skit]                       │
│              (appears when script ready)                │
└─────────────────────────────────────────────────────────┘
```

### Deliverable
Web UI showing collaboration in real-time

---

## Phase 4: Integration & Polish

### Goal
Seamless flow from writers' room → rendered skit.

### Tasks

1. **Auto-handoff to player**
   - "Script complete" triggers TTS generation
   - Smooth transition to playback view
   - Option to watch again, share, etc.

2. **Prompt/Premise Input**
   - Human gives starting point: "a job interview where the interviewer is a cat"
   - Or random premise generator

3. **Skit Library**
   - Save generated skits
   - Browse/replay past creations
   - Share links

4. **Performance Tuning**
   - Optimize agent prompts for comedy quality
   - A/B test different collaboration structures
   - Iterate on what's actually funny

---

## Phase 5: Skill Packaging

### Goal
Package this as a reusable OpenClaw skill.

### Components
- `SKILL.md` — instructions for agents to run improv sessions
- Comedy guide reference
- Scripts for room coordination
- UI components or templates

---

## Immediate Next Steps

1. [ ] Research sketch comedy — create `COMEDY-GUIDE.md`
2. [ ] Define agent roles and collaboration protocol
3. [ ] Prototype single-context multi-persona writers' room
4. [ ] Generate first collaborative script
5. [ ] Build basic writers' room UI

---

## Open Questions

- How much human input during creation vs. pure AI?
- Should there be a "director" agent or human director?
- How long should collaboration take? (Fast = 30 sec, Deliberate = 5 min)
- Can we stream the collaboration or does it need to batch?
- What models work best for comedy? (Claude tends to be good at humor)

---

*Created: 2025-02-02*
