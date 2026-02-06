/**
 * Unified Transform-Based Emotion System with Mouth Groups
 *
 * This system applies emotions using transforms and a unified mouth group.
 * All mouth shapes are positioned at a single location, eliminating drift.
 *
 * Key concepts:
 * - eyeRyRatio: Multiplier for eye height (1.0 = original, 0.7 = squint, 1.4 = wide)
 * - eyeCyDelta: Pixels to shift eyes vertically (negative = up)
 * - browY: Pixels to translate brows vertically
 * - browRotateL/R: Degrees to rotate brows (positive = outer down for left brow)
 * - Mouth shapes are in a group, toggled by emotion
 *
 * Canonical Emotions (11):
 * neutral, happy, sad, angry, worried, skeptical, tired, smug, dead, surprised, excited
 */

// Mouth shape definitions - all paths centered at (0,0)
export const MOUTH_SHAPES = {
  neutral:  { type: 'path', d: 'M-5 0 Q0 1 5 0', strokeWidth: 1.5 },
  smile:    { type: 'path', d: 'M-6 -1 Q0 5 6 -1', strokeWidth: 1.5 },
  bigsmile: { type: 'path', d: 'M-7 -2 Q0 6 7 -2', strokeWidth: 1.5 },
  frown:    { type: 'path', d: 'M-5 2 Q0 -2 5 2', strokeWidth: 1.5 },
  grimace:  { type: 'path', d: 'M-5 0 L5 0', strokeWidth: 2.5 },
  worried:  { type: 'path', d: 'M-5 1 Q-2 -1 0 1 Q2 3 5 1', strokeWidth: 1.5 },
  flat:     { type: 'path', d: 'M-4 0 L4 0', strokeWidth: 1.5 },
  tired:    { type: 'path', d: 'M-4 1 Q0 -1 4 1', strokeWidth: 1.5 },
  smirk:    { type: 'path', d: 'M-2 0 Q2 3 6 -1', strokeWidth: 1.5 },
  open:     { type: 'ellipse', rx: 4, ry: 1 }
};

// Map emotions to mouth shapes
export const EMOTION_MOUTH_MAP = {
  neutral:   'neutral',
  happy:     'smile',
  sad:       'frown',
  angry:     'grimace',
  worried:   'worried',
  skeptical: 'flat',
  tired:     'tired',
  smug:      'smirk',
  dead:      'open',
  surprised: 'open',
  excited:   'bigsmile'
};

// Open mouth ry values for emotions that use the open mouth
const OPEN_MOUTH_RY = {
  dead: 4,
  surprised: 6
};

// Unified transform-based emotion config - all values are relative
// Canonical 11 emotions only
export const TRANSFORM_EMOTIONS = {
  neutral: {
    eyeRyRatio: 1.0,
    eyeCyDelta: 0,
    pupilRyRatio: 1.0,
    pupilCyDelta: 0,
    browY: 0,
    browRotateL: 0,
    browRotateR: 0
  },
  happy: {
    eyeRyRatio: 0.7,
    eyeCyDelta: -1,
    pupilRyRatio: 0.8,
    pupilCyDelta: -1,
    browY: -2,
    browRotateL: -8,
    browRotateR: 8
  },
  sad: {
    eyeRyRatio: 0.85,
    eyeCyDelta: 2,
    pupilRyRatio: 0.9,
    pupilCyDelta: 2,
    browY: 3,
    browRotateL: -12,
    browRotateR: 12
  },
  angry: {
    eyeRyRatio: 0.85,
    eyeCyDelta: 2,
    pupilRyRatio: 0.9,
    pupilCyDelta: 2,
    browY: 3,
    browRotateL: 8,
    browRotateR: -8
  },
  worried: {
    eyeRyRatio: 0.9,
    eyeCyDelta: 1,
    pupilRyRatio: 0.9,
    pupilCyDelta: 1,
    browY: -1,
    browRotateL: -10,
    browRotateR: 10
  },
  skeptical: {
    eyeRyRatio: 0.6,
    eyeCyDelta: 1,
    pupilRyRatio: 0.7,
    pupilCyDelta: 1,
    browY: 1,
    browRotateL: -20,
    browRotateR: 5
  },
  tired: {
    eyeRyRatio: 0.4,
    eyeCyDelta: 2,
    pupilRyRatio: 0.5,
    pupilCyDelta: 2,
    browY: 4,
    browRotateL: 3,
    browRotateR: -3
  },
  smug: {
    eyeRyRatio: 0.75,
    eyeCyDelta: 0,
    pupilRyRatio: 0.8,
    pupilCyDelta: 0,
    browY: 0,
    browRotateL: 6,
    browRotateR: -6
  },
  dead: {
    eyeRyRatio: 0.7,
    eyeCyDelta: 0,
    pupilRyRatio: 0.8,
    pupilCyDelta: 0,
    browY: 0,
    browRotateL: 0,
    browRotateR: 0,
    xEyes: true
  },
  surprised: {
    eyeRyRatio: 1.4,
    eyeCyDelta: 0,
    pupilRyRatio: 1.3,
    pupilCyDelta: 0,
    browY: -5,
    browRotateL: -5,
    browRotateR: 5
  },
  excited: {
    eyeRyRatio: 1.3,
    eyeCyDelta: -1,
    pupilRyRatio: 1.2,
    pupilCyDelta: -1,
    browY: -4,
    browRotateL: -6,
    browRotateR: 6,
    highlight: 1
  }
};

/**
 * Create or get the mouth group for a sprite.
 * All mouth shapes are at local origin (0,0), positioned by group transform.
 *
 * @param {SVGElement} svg - The SVG element
 * @param {Object} origValues - Original face values
 * @returns {SVGGElement} The mouth group
 */
export function createMouthGroup(svg, origValues) {
  let mouthGroup = svg.querySelector('#mouth-group');
  if (mouthGroup) return mouthGroup;

  // Find mouth position from existing elements
  const mouthOpen = svg.querySelector('#mouth-open');
  const mouthClosed = svg.querySelector('#mouth-closed');

  let mouthCx = 50, mouthCy = 68;
  let mouthStroke = '#8d6e63';

  if (mouthOpen) {
    mouthCx = parseFloat(mouthOpen.getAttribute('cx') || 50);
    mouthCy = parseFloat(mouthOpen.getAttribute('cy') || 68);
  } else if (mouthClosed) {
    const center = origValues?.mouthCenter || getPathCenter(mouthClosed.getAttribute('d') || '');
    mouthCx = center.cx;
    mouthCy = center.cy;
  }

  if (mouthClosed) {
    mouthStroke = mouthClosed.getAttribute('stroke') || '#8d6e63';
  }

  // Hide original mouth elements
  if (mouthClosed) mouthClosed.setAttribute('opacity', '0');
  if (mouthOpen) mouthOpen.setAttribute('opacity', '0');

  // Create mouth group
  mouthGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  mouthGroup.id = 'mouth-group';
  mouthGroup.setAttribute('transform', `translate(${mouthCx}, ${mouthCy})`);

  // Create all mouth shapes at (0,0)
  for (const [name, shape] of Object.entries(MOUTH_SHAPES)) {
    let el;
    if (shape.type === 'path') {
      el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      el.setAttribute('d', shape.d);
      el.setAttribute('stroke', mouthStroke);
      el.setAttribute('stroke-width', shape.strokeWidth || 1.5);
      el.setAttribute('fill', 'none');
      el.setAttribute('stroke-linecap', 'round');
    } else {
      el = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      el.setAttribute('cx', '0');
      el.setAttribute('cy', '0');
      el.setAttribute('rx', shape.rx);
      el.setAttribute('ry', shape.ry);
      el.setAttribute('fill', '#5d4037');
    }
    el.id = `mouth-${name}`;
    el.setAttribute('opacity', '0');
    mouthGroup.appendChild(el);
  }

  // Add to head-bottom group or svg
  const headBottom = svg.querySelector('#head-bottom');
  if (headBottom) {
    headBottom.appendChild(mouthGroup);
  } else {
    svg.appendChild(mouthGroup);
  }

  return mouthGroup;
}

/**
 * Apply mouth shape for an emotion.
 *
 * @param {SVGElement} svg - The SVG element
 * @param {string} emotion - Emotion name
 * @param {Object} origValues - Original face values
 */
export function applyMouthEmotion(svg, emotion, origValues) {
  const mouthGroup = createMouthGroup(svg, origValues);
  const shapeName = EMOTION_MOUTH_MAP[emotion] || 'neutral';

  // Hide all mouth shapes
  mouthGroup.querySelectorAll('path, ellipse').forEach(el => {
    el.setAttribute('opacity', '0');
  });

  // Show the selected shape
  const activeShape = mouthGroup.querySelector(`#mouth-${shapeName}`);
  if (activeShape) {
    activeShape.setAttribute('opacity', '1');

    // For open mouth, set appropriate ry
    if (shapeName === 'open' && OPEN_MOUTH_RY[emotion]) {
      activeShape.setAttribute('ry', OPEN_MOUTH_RY[emotion]);
    }
  }
}

/**
 * Animate mouth for speaking.
 * Switches to mouth-open ellipse and sets ry based on amplitude.
 *
 * @param {SVGElement} svg - The SVG element
 * @param {number} amplitude - Speech amplitude (0-1)
 * @param {Object} origValues - Original face values (optional)
 */
export function animateMouthForSpeaking(svg, amplitude, origValues) {
  const mouthGroup = createMouthGroup(svg, origValues);

  // Hide all shapes, show mouth-open
  mouthGroup.querySelectorAll('path').forEach(el => {
    el.setAttribute('opacity', '0');
  });

  const mouthOpen = mouthGroup.querySelector('#mouth-open');
  if (mouthOpen) {
    mouthOpen.setAttribute('opacity', '1');
    // Map amplitude to ry (1 = closed, 8 = wide open)
    const ry = 1 + (amplitude * 7);
    mouthOpen.setAttribute('ry', ry.toFixed(1));
  }
}

/**
 * Reset mouth to closed state (for when speaking stops).
 *
 * @param {SVGElement} svg - The SVG element
 * @param {string} emotion - Current emotion to restore
 * @param {Object} origValues - Original face values
 */
export function resetMouthAfterSpeaking(svg, emotion, origValues) {
  applyMouthEmotion(svg, emotion, origValues);
}

/**
 * Capture original face values from a sprite's SVG container.
 * This stores the original values so we can apply transforms relative to them.
 *
 * @param {HTMLElement} container - Element containing the SVG
 * @returns {Object|null} Original face values or null if no eyes found
 */
export function captureOriginalFaceValues(container) {
  const svg = container.querySelector ? container.querySelector('svg') : container;
  if (!svg) return null;

  const eyeL = svg.querySelector('#eye-left-white');
  const eyeR = svg.querySelector('#eye-right-white');
  const pupilL = svg.querySelector('#eye-left-pupil');
  const pupilR = svg.querySelector('#eye-right-pupil');
  const browL = svg.querySelector('#brow-left');
  const browR = svg.querySelector('#brow-right');
  const mouth = svg.querySelector('#mouth-closed');
  const mouthOpen = svg.querySelector('#mouth-open');

  // Need at least eyes
  if (!eyeL) return null;

  // Get eye values
  const eyeRy = parseFloat(eyeL.getAttribute('ry') || 7);
  const eyeCy = parseFloat(eyeL.getAttribute('cy') || 50);
  const eyeRx = parseFloat(eyeL.getAttribute('rx') || eyeRy);
  const eyeCx = parseFloat(eyeL.getAttribute('cx') || 40);

  // Get right eye cx for X eye positioning
  const eyeRCx = parseFloat(eyeR?.getAttribute('cx') || 60);

  // Get pupil values - check each eye independently for circle vs ellipse
  const pupilLRy = parseFloat(pupilL?.getAttribute('ry') || pupilL?.getAttribute('r') || 5);
  const pupilRRy = parseFloat(pupilR?.getAttribute('ry') || pupilR?.getAttribute('r') || 5);
  const pupilCy = parseFloat(pupilL?.getAttribute('cy') || eyeCy);
  const pupilLUsesR = pupilL && !pupilL.hasAttribute('ry');
  const pupilRUsesR = pupilR && !pupilR.hasAttribute('ry');

  // Get brow path data and centers for rotation
  const browLeftD = browL?.getAttribute('d') || '';
  const browRightD = browR?.getAttribute('d') || '';
  const browLeftCenter = getPathCenter(browLeftD);
  const browRightCenter = getPathCenter(browRightD);

  // Get mouth path data, center, and original stroke
  const mouthD = mouth?.getAttribute('d') || '';
  const mouthCenter = getPathCenter(mouthD);
  const mouthStroke = mouth?.getAttribute('stroke') || '#8d6e63';

  // Get mouth-open values if present
  const mouthOpenCx = parseFloat(mouthOpen?.getAttribute('cx') || 50);
  const mouthOpenCy = parseFloat(mouthOpen?.getAttribute('cy') || 68);
  const mouthOpenRy = parseFloat(mouthOpen?.getAttribute('ry') || 3);
  const mouthOpenRx = parseFloat(mouthOpen?.getAttribute('rx') || 5);

  return {
    eyeRy,
    eyeCy,
    eyeRx,
    eyeCx,
    eyeRCx,
    pupilLRy,
    pupilRRy,
    pupilCy,
    pupilLUsesR,
    pupilRUsesR,
    browLeftD,
    browRightD,
    browLeftCenter,
    browRightCenter,
    mouthD,
    mouthCenter,
    mouthStroke,
    mouthOpenCx,
    mouthOpenCy,
    mouthOpenRy,
    mouthOpenRx
  };
}

/**
 * Apply an emotion to a sprite using transforms and mouth groups.
 *
 * @param {HTMLElement} container - Element containing the SVG
 * @param {string} emotion - Emotion name from TRANSFORM_EMOTIONS
 * @param {Object} origValues - Original face values from captureOriginalFaceValues
 * @returns {Object} Updated eye values for blink system
 */
export function applyEmotion(container, emotion, origValues) {
  const svg = container.querySelector ? container.querySelector('svg') : container;
  if (!svg || !origValues) return null;

  const cfg = TRANSFORM_EMOTIONS[emotion];
  if (!cfg) return null;

  // Get face elements
  const eyeLeftWhite = svg.querySelector('#eye-left-white');
  const eyeRightWhite = svg.querySelector('#eye-right-white');
  const eyeLeftPupil = svg.querySelector('#eye-left-pupil');
  const eyeRightPupil = svg.querySelector('#eye-right-pupil');
  const browLeft = svg.querySelector('#brow-left');
  const browRight = svg.querySelector('#brow-right');
  const highlightLeft = svg.querySelector('#eye-left-highlight');
  const highlightRight = svg.querySelector('#eye-right-highlight');

  // Handle X eyes for dead emotion
  if (cfg.xEyes) {
    // Hide normal eyes
    if (eyeLeftWhite) eyeLeftWhite.setAttribute('opacity', '0');
    if (eyeRightWhite) eyeRightWhite.setAttribute('opacity', '0');
    if (eyeLeftPupil) eyeLeftPupil.setAttribute('opacity', '0');
    if (eyeRightPupil) eyeRightPupil.setAttribute('opacity', '0');

    // Create or show X eyes
    let xEyesGroup = svg.querySelector('#x-eyes-group');
    if (!xEyesGroup) {
      xEyesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      xEyesGroup.id = 'x-eyes-group';

      const leftCx = origValues.eyeCx;
      const rightCx = origValues.eyeRCx;
      const cy = origValues.eyeCy;
      const size = Math.max(3, origValues.eyeRy * 0.8);

      xEyesGroup.innerHTML = `
        <line x1="${leftCx - size}" y1="${cy - size}" x2="${leftCx + size}" y2="${cy + size}" stroke="#000" stroke-width="2"/>
        <line x1="${leftCx + size}" y1="${cy - size}" x2="${leftCx - size}" y2="${cy + size}" stroke="#000" stroke-width="2"/>
        <line x1="${rightCx - size}" y1="${cy - size}" x2="${rightCx + size}" y2="${cy + size}" stroke="#000" stroke-width="2"/>
        <line x1="${rightCx + size}" y1="${cy - size}" x2="${rightCx - size}" y2="${cy + size}" stroke="#000" stroke-width="2"/>
      `;
      svg.appendChild(xEyesGroup);
    }
    xEyesGroup.setAttribute('opacity', '1');
  } else {
    // Show normal eyes, hide X eyes
    const xEyesGroup = svg.querySelector('#x-eyes-group');
    if (xEyesGroup) xEyesGroup.setAttribute('opacity', '0');

    // Apply eye whites
    const newEyeRy = origValues.eyeRy * cfg.eyeRyRatio;
    const newEyeCy = origValues.eyeCy + cfg.eyeCyDelta;

    if (eyeLeftWhite) {
      eyeLeftWhite.setAttribute('opacity', '1');
      eyeLeftWhite.setAttribute('ry', newEyeRy);
      eyeLeftWhite.setAttribute('cy', newEyeCy);
    }
    if (eyeRightWhite) {
      eyeRightWhite.setAttribute('opacity', '1');
      eyeRightWhite.setAttribute('ry', newEyeRy);
      eyeRightWhite.setAttribute('cy', newEyeCy);
    }

    // Apply pupils
    const newPupilLRy = origValues.pupilLRy * cfg.pupilRyRatio;
    const newPupilRRy = origValues.pupilRRy * cfg.pupilRyRatio;
    const newPupilCy = origValues.pupilCy + cfg.pupilCyDelta;

    if (eyeLeftPupil) {
      eyeLeftPupil.setAttribute('opacity', '1');
      if (origValues.pupilLUsesR) {
        eyeLeftPupil.setAttribute('r', newPupilLRy);
      } else {
        eyeLeftPupil.setAttribute('ry', newPupilLRy);
      }
      eyeLeftPupil.setAttribute('cy', newPupilCy);
    }
    if (eyeRightPupil) {
      eyeRightPupil.setAttribute('opacity', '1');
      if (origValues.pupilRUsesR) {
        eyeRightPupil.setAttribute('r', newPupilRRy);
      } else {
        eyeRightPupil.setAttribute('ry', newPupilRRy);
      }
      eyeRightPupil.setAttribute('cy', newPupilCy);
    }
  }

  // Apply brows
  if (browLeft && origValues.browLeftD) {
    browLeft.setAttribute('d', origValues.browLeftD);
    const { cx, cy } = origValues.browLeftCenter;
    browLeft.setAttribute('transform',
      `translate(0, ${cfg.browY}) rotate(${cfg.browRotateL}, ${cx}, ${cy})`);
  }
  if (browRight && origValues.browRightD) {
    browRight.setAttribute('d', origValues.browRightD);
    const { cx, cy } = origValues.browRightCenter;
    browRight.setAttribute('transform',
      `translate(0, ${cfg.browY}) rotate(${cfg.browRotateR}, ${cx}, ${cy})`);
  }

  // Apply mouth using mouth group
  applyMouthEmotion(svg, emotion, origValues);

  // Apply highlights
  const highlightOpacity = cfg.highlight ?? 0;
  if (highlightLeft) highlightLeft.setAttribute('opacity', highlightOpacity);
  if (highlightRight) highlightRight.setAttribute('opacity', highlightOpacity);

  // Return updated eye values for blink system
  const newEyeRy = origValues.eyeRy * cfg.eyeRyRatio;
  const newPupilLRy = origValues.pupilLRy * cfg.pupilRyRatio;
  const newPupilRRy = origValues.pupilRRy * cfg.pupilRyRatio;

  return {
    leftWhiteRy: newEyeRy,
    rightWhiteRy: newEyeRy,
    leftPupilRy: newPupilLRy,
    rightPupilRy: newPupilRRy,
    pupilLUsesR: origValues.pupilLUsesR,
    pupilRUsesR: origValues.pupilRUsesR
  };
}

/**
 * Get the center point of a path for rotation pivot.
 *
 * @param {string} d - SVG path d attribute
 * @returns {Object} Center point {cx, cy}
 */
export function getPathCenter(d) {
  if (!d) return { cx: 50, cy: 50 };

  const coords = [];
  const commandRegex = /([MLHVCSQTAZ])\s*([-\d.,\s]+)/gi;
  let match;

  while ((match = commandRegex.exec(d)) !== null) {
    const cmd = match[1].toUpperCase();
    const numStr = match[2];
    const nums = numStr.match(/-?[\d.]+/g);
    if (!nums) continue;

    if (cmd === 'A') continue;

    if (cmd === 'H') {
      nums.forEach(n => coords.push({ x: parseFloat(n), y: null }));
    } else if (cmd === 'V') {
      nums.forEach(n => coords.push({ x: null, y: parseFloat(n) }));
    } else {
      for (let i = 0; i < nums.length - 1; i += 2) {
        coords.push({ x: parseFloat(nums[i]), y: parseFloat(nums[i + 1]) });
      }
    }
  }

  if (coords.length === 0) return { cx: 50, cy: 50 };

  let sumX = 0, sumY = 0, countX = 0, countY = 0;
  for (const c of coords) {
    if (c.x !== null) { sumX += c.x; countX++; }
    if (c.y !== null) { sumY += c.y; countY++; }
  }

  return {
    cx: countX > 0 ? sumX / countX : 50,
    cy: countY > 0 ? sumY / countY : 50
  };
}

/**
 * List of available emotions (canonical 11)
 */
export const EMOTION_LIST = Object.keys(TRANSFORM_EMOTIONS);

/**
 * Reset a sprite to neutral emotion
 *
 * @param {HTMLElement} container - Element containing the SVG
 * @param {Object} origValues - Original face values
 */
export function resetToNeutral(container, origValues) {
  return applyEmotion(container, 'neutral', origValues);
}
