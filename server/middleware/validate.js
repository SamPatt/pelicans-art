/**
 * Validation middleware and utilities for sprites and skits
 */

// Required element IDs for sprite animation to work
const REQUIRED_SPRITE_ELEMENTS = [
  'eye-left-white',
  'eye-right-white',
  'eye-left-pupil',
  'eye-right-pupil',
  'brow-left',
  'brow-right',
  'mouth-open'
];

// Required groups
const REQUIRED_SPRITE_GROUPS = ['body', 'head-top', 'head-bottom'];

// Valid emotions (canonical 11)
const VALID_EMOTIONS = [
  'neutral', 'happy', 'sad', 'angry', 'worried',
  'skeptical', 'tired', 'smug', 'dead', 'surprised', 'excited'
];

// Valid shot types
const VALID_SHOT_TYPES = ['wide', 'two-shot', 'closeup', 'extreme-closeup', 'medium'];

// Valid script actions
const VALID_ACTIONS = [
  'shot', 'say', 'emote', 'pause', 'enter', 'exit', 'move', 'look', 'turn', 'face',
  'spawn', 'despawn', 'prop-move', 'prop-hold', 'prop-drop', 'prop-rotate', 'prop-scale', 'prop-animate'
];

// Valid animation presets for prop-animate
const VALID_PROP_ANIMATIONS = ['bounce', 'spin', 'shake', 'pulse', 'float'];

/**
 * Check if SVG has an element with given ID (supports single and double quotes)
 */
function hasId(svg, id) {
  return new RegExp(`id=["']${id}["']`).test(svg);
}

/**
 * Validate sprite SVG structure
 * Returns { valid: boolean, errors: string[], warnings: string[] }
 */
export function validateSpriteSvg(svg) {
  const errors = [];
  const warnings = [];

  if (!svg || typeof svg !== 'string') {
    return { valid: false, errors: ['SVG content is required'], warnings: [] };
  }

  // Check for SVG element
  if (!svg.includes('<svg')) {
    errors.push('Not a valid SVG (missing <svg> element)');
    return { valid: false, errors, warnings };
  }

  // Check viewBox
  const viewBoxMatch = svg.match(/viewBox=["']([^"']+)["']/);
  if (!viewBoxMatch) {
    errors.push('Missing viewBox attribute');
  } else if (viewBoxMatch[1] !== '0 0 100 150') {
    warnings.push(`ViewBox is "${viewBoxMatch[1]}", expected "0 0 100 150"`);
  }

  // Check required groups (support both single and double quotes)
  for (const group of REQUIRED_SPRITE_GROUPS) {
    if (!hasId(svg, group)) {
      errors.push(`Missing required group: ${group}`);
    }
  }

  // Check required elements (support both single and double quotes)
  for (const element of REQUIRED_SPRITE_ELEMENTS) {
    if (!hasId(svg, element)) {
      errors.push(`Missing required element: ${element}`);
    }
  }

  // Check for pupil class on pupil elements
  if (hasId(svg, 'eye-left-pupil') && !svg.match(/id=["']eye-left-pupil["'][^>]*class=["'][^"']*pupil/)) {
    warnings.push('eye-left-pupil should have class="pupil" for eye tracking');
  }
  if (hasId(svg, 'eye-right-pupil') && !svg.match(/id=["']eye-right-pupil["'][^>]*class=["'][^"']*pupil/)) {
    warnings.push('eye-right-pupil should have class="pupil" for eye tracking');
  }

  // Check mouth-open has opacity="0"
  if (hasId(svg, 'mouth-open') && !svg.match(/id=["']mouth-open["'][^>]*opacity=["']0["']/)) {
    warnings.push('mouth-open should have opacity="0" initially');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Extract Y position from an SVG element (heuristic)
 */
function extractYPosition(svg, elementId) {
  // Try to find cy attribute (for ellipse/circle) - support single and double quotes
  const cyMatch = svg.match(new RegExp(`id=["']${elementId}["'][^>]*cy=["']([\\d.]+)["']`));
  if (cyMatch) return parseFloat(cyMatch[1]);

  // Try to find y in d attribute for path (very basic)
  const pathMatch = svg.match(new RegExp(`id=["']${elementId}["'][^>]*d=["'][^"']*[\\s,]([\\d.]+)`));
  if (pathMatch) return parseFloat(pathMatch[1]);

  return null;
}

/**
 * Validate skit structure
 */
export function validateSkit(skit) {
  const errors = [];
  const warnings = [];

  if (!skit) {
    return { valid: false, errors: ['Skit data is required'], warnings: [] };
  }

  // Check required fields
  if (!skit.stage?.background) {
    errors.push('Missing stage.background');
  }

  if (!skit.cast || Object.keys(skit.cast).length === 0) {
    errors.push('Missing cast (at least one character required)');
  }

  if (!skit.script || !Array.isArray(skit.script)) {
    errors.push('Missing script array');
  }

  // Validate cast
  if (skit.cast) {
    for (const [charName, charDef] of Object.entries(skit.cast)) {
      if (!charDef.sprite) {
        errors.push(`Character "${charName}" missing sprite`);
      }
      if (charDef.x === undefined) {
        warnings.push(`Character "${charName}" missing x position, will default to 50`);
      }
    }
  }

  // Validate props if present
  const propNames = new Set(Object.keys(skit.props || {}));
  if (skit.props) {
    for (const [propId, propDef] of Object.entries(skit.props)) {
      if (!propDef.prop) {
        errors.push(`Prop "${propId}" missing prop asset name`);
      }
      if (propDef.layer && !['background', 'foreground'].includes(propDef.layer)) {
        warnings.push(`Prop "${propId}" has invalid layer "${propDef.layer}", should be "background" or "foreground"`);
      }
    }
  }

  // Validate script
  if (Array.isArray(skit.script)) {
    const castNames = new Set(Object.keys(skit.cast || {}));

    skit.script.forEach((beat, index) => {
      if (!beat.do) {
        errors.push(`Script beat ${index}: missing "do" action`);
        return;
      }

      if (!VALID_ACTIONS.includes(beat.do)) {
        warnings.push(`Script beat ${index}: unknown action "${beat.do}"`);
      }

      // Validate character references
      if (beat.who && !castNames.has(beat.who)) {
        errors.push(`Script beat ${index}: unknown character "${beat.who}"`);
      }

      // Validate prop references
      if (beat.what && !propNames.has(beat.what)) {
        errors.push(`Script beat ${index}: unknown prop "${beat.what}"`);
      }

      // Validate specific actions
      switch (beat.do) {
        case 'say':
          if (!beat.line) {
            errors.push(`Script beat ${index}: "say" action missing "line"`);
          }
          break;

        case 'emote':
          if (beat.emotion && !VALID_EMOTIONS.includes(beat.emotion)) {
            warnings.push(`Script beat ${index}: unknown emotion "${beat.emotion}"`);
          }
          break;

        case 'shot':
          if (beat.type && !VALID_SHOT_TYPES.includes(beat.type)) {
            warnings.push(`Script beat ${index}: unknown shot type "${beat.type}"`);
          }
          break;

        case 'enter':
          if (!beat.from) {
            errors.push(`Script beat ${index}: "enter" action missing "from"`);
          }
          break;

        case 'exit':
          if (!beat.to) {
            errors.push(`Script beat ${index}: "exit" action missing "to"`);
          }
          break;

        // Prop actions
        case 'spawn':
        case 'despawn':
        case 'prop-move':
        case 'prop-rotate':
        case 'prop-scale':
          if (!beat.what) {
            errors.push(`Script beat ${index}: "${beat.do}" action missing "what" (prop id)`);
          }
          break;

        case 'prop-hold':
          if (!beat.what) {
            errors.push(`Script beat ${index}: "prop-hold" action missing "what" (prop id)`);
          }
          if (!beat.who) {
            errors.push(`Script beat ${index}: "prop-hold" action missing "who" (character id)`);
          }
          break;

        case 'prop-drop':
          if (!beat.what) {
            errors.push(`Script beat ${index}: "prop-drop" action missing "what" (prop id)`);
          }
          break;

        case 'prop-animate':
          if (!beat.what) {
            errors.push(`Script beat ${index}: "prop-animate" action missing "what" (prop id)`);
          }
          if (beat.animation && !VALID_PROP_ANIMATIONS.includes(beat.animation)) {
            warnings.push(`Script beat ${index}: unknown prop animation "${beat.animation}"`);
          }
          break;
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Express middleware to validate sprite on create (svg required)
 */
export function validateSpriteMiddleware(req, res, next) {
  const { svg } = req.body;

  if (!svg) {
    return res.status(400).json({ error: true, message: 'SVG content is required' });
  }

  const validation = validateSpriteSvg(svg);

  // Attach validation result for route to use
  req.spriteValidation = validation;

  // Don't block on warnings, only errors
  if (!validation.valid) {
    return res.status(400).json({
      error: true,
      message: 'Invalid sprite SVG',
      validation
    });
  }

  next();
}

/**
 * Express middleware to validate sprite on update (svg optional for metadata-only updates)
 */
export function validateSpriteUpdateMiddleware(req, res, next) {
  const { svg } = req.body;

  // If no svg provided, this is a metadata-only update - skip validation
  if (!svg) {
    req.spriteValidation = null;
    return next();
  }

  const validation = validateSpriteSvg(svg);

  // Attach validation result for route to use
  req.spriteValidation = validation;

  // Don't block on warnings, only errors
  if (!validation.valid) {
    return res.status(400).json({
      error: true,
      message: 'Invalid sprite SVG',
      validation
    });
  }

  next();
}

/**
 * Express middleware to validate skit on create/update
 */
export function validateSkitMiddleware(req, res, next) {
  const validation = validateSkit(req.body);

  req.skitValidation = validation;

  if (!validation.valid) {
    return res.status(400).json({
      error: true,
      message: 'Invalid skit structure',
      validation
    });
  }

  next();
}
