/**
 * Unified Transform-Based Emotion System
 *
 * This system applies emotions using transforms and deltas instead of hardcoded
 * absolute coordinates. It works for any sprite regardless of face position.
 *
 * Key concepts:
 * - eyeRyRatio: Multiplier for eye height (1.0 = original, 0.7 = squint, 1.4 = wide)
 * - eyeCyDelta: Pixels to shift eyes vertically (negative = up)
 * - browY: Pixels to translate brows vertically
 * - browRotateL/R: Degrees to rotate brows (positive = outer down for left brow)
 * - mouthY: Pixels to translate mouth vertically
 * - mouthScaleY/X: Scale factors for mouth shape
 */

// Unified transform-based emotion config - all values are relative
export const TRANSFORM_EMOTIONS = {
  neutral: {
    eyeRyRatio: 1.0,
    eyeCyDelta: 0,
    pupilRyRatio: 1.0,
    pupilCyDelta: 0,
    browY: 0,
    browRotateL: 0,
    browRotateR: 0,
    mouthY: 0,
    mouthScaleY: 1.0,
    mouthScaleX: 1.0
  },
  happy: {
    eyeRyRatio: 0.7,      // Squint for happy
    eyeCyDelta: -1,
    pupilRyRatio: 0.8,
    pupilCyDelta: -1,
    browY: -2,            // Brows raised
    browRotateL: -8,      // Outer edges up
    browRotateR: 8,
    mouthY: 1,
    mouthScaleY: 1.3,     // Taller mouth (smile)
    mouthScaleX: 1.1
  },
  sad: {
    eyeRyRatio: 0.85,
    eyeCyDelta: 2,        // Eyes droop
    pupilRyRatio: 0.9,
    pupilCyDelta: 2,
    browY: 0,
    browRotateL: 12,      // Inner edges up (worried brows)
    browRotateR: -12,
    mouthY: 2,
    mouthScaleY: 0.7,     // Compressed mouth
    mouthScaleX: 0.9
  },
  angry: {
    eyeRyRatio: 0.7,      // Squint
    eyeCyDelta: 0,
    pupilRyRatio: 0.8,
    pupilCyDelta: 0,
    browY: 2,             // Brows down
    browRotateL: -15,     // Furrowed (inner down, outer up)
    browRotateR: 15,
    mouthY: 0,
    mouthScaleY: 0.5,     // Tight line
    mouthScaleX: 1.0
  },
  surprised: {
    eyeRyRatio: 1.4,      // Wide eyes
    eyeCyDelta: 0,
    pupilRyRatio: 1.3,
    pupilCyDelta: 0,
    browY: -5,            // Brows way up
    browRotateL: -5,
    browRotateR: 5,
    mouthY: 3,
    mouthScaleY: 1.8,     // Big O mouth
    mouthScaleX: 0.8,
    useMouthOpen: true    // Use mouth-open element if available
  },
  excited: {
    eyeRyRatio: 1.3,
    eyeCyDelta: -1,
    pupilRyRatio: 1.2,
    pupilCyDelta: -1,
    browY: -4,
    browRotateL: -6,
    browRotateR: 6,
    mouthY: 2,
    mouthScaleY: 1.5,
    mouthScaleX: 1.1,
    highlight: 1
  },
  worried: {
    eyeRyRatio: 0.9,
    eyeCyDelta: 1,
    pupilRyRatio: 0.9,
    pupilCyDelta: 1,
    browY: -1,
    browRotateL: 10,      // Inner high
    browRotateR: -10,
    mouthY: 1,
    mouthScaleY: 0.8,
    mouthScaleX: 0.85
  },
  smug: {
    eyeRyRatio: 0.75,
    eyeCyDelta: 0,
    pupilRyRatio: 0.8,
    pupilCyDelta: 0,
    browY: 0,
    browRotateL: -10,     // Asymmetric
    browRotateR: 5,
    mouthY: 0,
    mouthScaleY: 1.1,
    mouthScaleX: 1.05
  },
  tired: {
    eyeRyRatio: 0.5,      // Very squinty
    eyeCyDelta: 2,
    pupilRyRatio: 0.6,
    pupilCyDelta: 2,
    browY: 2,
    browRotateL: 5,
    browRotateR: -5,
    mouthY: 1,
    mouthScaleY: 0.6,
    mouthScaleX: 0.9
  },
  skeptical: {
    eyeRyRatio: 0.8,
    eyeCyDelta: 0,
    pupilRyRatio: 0.85,
    pupilCyDelta: 0,
    browY: 0,
    browRotateL: -12,     // Left brow raised
    browRotateR: 8,       // Right brow lowered
    mouthY: 0,
    mouthScaleY: 0.7,
    mouthScaleX: 0.85
  },
  dead: {
    eyeRyRatio: 0.7,
    eyeCyDelta: 0,
    pupilRyRatio: 0.8,
    pupilCyDelta: 0,
    browY: 0,
    browRotateL: 0,
    browRotateR: 0,
    mouthY: 2,
    mouthScaleY: 1.5,
    mouthScaleX: 0.7,
    xEyes: true,
    useMouthOpen: true
  },
  scared: {
    eyeRyRatio: 1.3,
    eyeCyDelta: -1,
    pupilRyRatio: 1.2,
    pupilCyDelta: -1,
    browY: -3,
    browRotateL: 8,       // Inner high (worried)
    browRotateR: -8,
    mouthY: 2,
    mouthScaleY: 1.4,
    mouthScaleX: 0.75,
    useMouthOpen: true
  },
  thinking: {
    eyeRyRatio: 0.9,
    eyeCyDelta: -1,
    pupilRyRatio: 0.9,
    pupilCyDelta: -1,
    browY: -1,
    browRotateL: -8,      // Asymmetric
    browRotateR: 3,
    mouthY: 0,
    mouthScaleY: 0.8,
    mouthScaleX: 0.9
  },
  confused: {
    eyeRyRatio: 1.1,
    eyeCyDelta: 0,
    pupilRyRatio: 1.0,
    pupilCyDelta: 0,
    browY: -1,
    browRotateL: 10,      // Very asymmetric
    browRotateR: -5,
    mouthY: 1,
    mouthScaleY: 0.9,
    mouthScaleX: 0.8
  }
};

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

  // Get pupil values - could be circle (r) or ellipse (ry)
  const pupilRy = parseFloat(pupilL?.getAttribute('ry') || pupilL?.getAttribute('r') || 5);
  const pupilCy = parseFloat(pupilL?.getAttribute('cy') || eyeCy);
  const pupilUsesR = pupilL && !pupilL.hasAttribute('ry');

  // Get brow path data and centers for rotation
  const browLeftD = browL?.getAttribute('d') || '';
  const browRightD = browR?.getAttribute('d') || '';
  const browLeftCenter = getPathCenter(browLeftD);
  const browRightCenter = getPathCenter(browRightD);

  // Get mouth path data and center
  const mouthD = mouth?.getAttribute('d') || '';
  const mouthCenter = getPathCenter(mouthD);

  // Get mouth-open values if present
  const mouthOpenRy = parseFloat(mouthOpen?.getAttribute('ry') || 3);
  const mouthOpenRx = parseFloat(mouthOpen?.getAttribute('rx') || 5);

  return {
    eyeRy,
    eyeCy,
    eyeRx,
    eyeCx,
    eyeRCx,
    pupilRy,
    pupilCy,
    pupilUsesR,
    browLeftD,
    browRightD,
    browLeftCenter,
    browRightCenter,
    mouthD,
    mouthCenter,
    mouthOpenRy,
    mouthOpenRx
  };
}

/**
 * Apply an emotion to a sprite using transforms.
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

  // Get all face elements
  const eyeLeftWhite = svg.querySelector('#eye-left-white');
  const eyeRightWhite = svg.querySelector('#eye-right-white');
  const eyeLeftPupil = svg.querySelector('#eye-left-pupil');
  const eyeRightPupil = svg.querySelector('#eye-right-pupil');
  const browLeft = svg.querySelector('#brow-left');
  const browRight = svg.querySelector('#brow-right');
  const mouthClosed = svg.querySelector('#mouth-closed');
  const mouthOpen = svg.querySelector('#mouth-open');
  const mouthSmile = svg.querySelector('#mouth-smile');
  const highlightLeft = svg.querySelector('#eye-left-highlight');
  const highlightRight = svg.querySelector('#eye-right-highlight');

  // Apply eye whites - use ratio for ry, delta for cy
  const newEyeRy = origValues.eyeRy * cfg.eyeRyRatio;
  const newEyeCy = origValues.eyeCy + cfg.eyeCyDelta;

  if (eyeLeftWhite) {
    eyeLeftWhite.setAttribute('ry', newEyeRy);
    eyeLeftWhite.setAttribute('cy', newEyeCy);
  }
  if (eyeRightWhite) {
    eyeRightWhite.setAttribute('ry', newEyeRy);
    eyeRightWhite.setAttribute('cy', newEyeCy);
  }

  // Apply pupils - use ratio for ry/r, delta for cy
  const newPupilRy = origValues.pupilRy * cfg.pupilRyRatio;
  const newPupilCy = origValues.pupilCy + cfg.pupilCyDelta;

  if (eyeLeftPupil) {
    if (origValues.pupilUsesR) {
      eyeLeftPupil.setAttribute('r', newPupilRy);
    } else {
      eyeLeftPupil.setAttribute('ry', newPupilRy);
    }
    eyeLeftPupil.setAttribute('cy', newPupilCy);
  }
  if (eyeRightPupil) {
    if (origValues.pupilUsesR) {
      eyeRightPupil.setAttribute('r', newPupilRy);
    } else {
      eyeRightPupil.setAttribute('ry', newPupilRy);
    }
    eyeRightPupil.setAttribute('cy', newPupilCy);
  }

  // Apply brows - keep original path, use transforms for translation and rotation
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

  // Apply mouth - keep original path, use transforms
  // Check for alternate mouth elements first
  if (cfg.useMouthOpen && mouthOpen) {
    // Use mouth-open element (scale it up)
    if (mouthClosed) mouthClosed.setAttribute('opacity', '0');
    if (mouthSmile) mouthSmile.setAttribute('opacity', '0');
    mouthOpen.setAttribute('opacity', '1');
    mouthOpen.setAttribute('ry', origValues.mouthOpenRy * cfg.mouthScaleY);
    mouthOpen.setAttribute('rx', origValues.mouthOpenRx * cfg.mouthScaleX);
  } else if (emotion === 'happy' && mouthSmile) {
    // Use smile mouth if available
    if (mouthClosed) mouthClosed.setAttribute('opacity', '0');
    if (mouthOpen) mouthOpen.setAttribute('opacity', '0');
    mouthSmile.setAttribute('opacity', '1');
  } else if (mouthClosed && origValues.mouthD) {
    // Transform the closed mouth
    if (mouthOpen) mouthOpen.setAttribute('opacity', '0');
    if (mouthSmile) mouthSmile.setAttribute('opacity', '0');
    mouthClosed.setAttribute('opacity', '1');
    mouthClosed.setAttribute('d', origValues.mouthD);
    const { cx, cy } = origValues.mouthCenter;
    mouthClosed.setAttribute('transform',
      `translate(0, ${cfg.mouthY}) translate(${cx}, ${cy}) scale(${cfg.mouthScaleX}, ${cfg.mouthScaleY}) translate(${-cx}, ${-cy})`);
    // Reset fill/stroke to defaults
    mouthClosed.setAttribute('fill', 'none');
    mouthClosed.setAttribute('stroke', mouthClosed.dataset.originalStroke || '#8d6e63');
  }

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

      // Position X eyes based on actual eye positions
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
    if (eyeLeftWhite) eyeLeftWhite.setAttribute('opacity', '1');
    if (eyeRightWhite) eyeRightWhite.setAttribute('opacity', '1');
    if (eyeLeftPupil) eyeLeftPupil.setAttribute('opacity', '1');
    if (eyeRightPupil) eyeRightPupil.setAttribute('opacity', '1');
    const xEyesGroup = svg.querySelector('#x-eyes-group');
    if (xEyesGroup) xEyesGroup.setAttribute('opacity', '0');
  }

  // Apply highlights if specified
  if (cfg.highlight !== undefined) {
    if (highlightLeft) highlightLeft.setAttribute('opacity', cfg.highlight);
    if (highlightRight) highlightRight.setAttribute('opacity', cfg.highlight);
  }

  // Return updated eye values for blink system
  return {
    leftWhiteRy: newEyeRy,
    rightWhiteRy: newEyeRy,
    leftPupilRy: newPupilRy,
    rightPupilRy: newPupilRy,
    pupilUsesR: origValues.pupilUsesR
  };
}

/**
 * Get the center point of a path for rotation pivot.
 * Parses the path d attribute to find coordinate pairs and averages them.
 *
 * @param {string} d - SVG path d attribute
 * @returns {Object} Center point {cx, cy}
 */
export function getPathCenter(d) {
  if (!d) return { cx: 50, cy: 50 };

  // Extract all numbers from the path
  const nums = d.match(/[\d.]+/g);
  if (!nums || nums.length < 2) return { cx: 50, cy: 50 };

  // Parse coordinate pairs
  let sumX = 0, sumY = 0, count = 0;
  for (let i = 0; i < nums.length - 1; i += 2) {
    sumX += parseFloat(nums[i]);
    sumY += parseFloat(nums[i + 1]);
    count++;
  }

  if (count === 0) return { cx: 50, cy: 50 };
  return { cx: sumX / count, cy: sumY / count };
}

/**
 * List of available emotions
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
