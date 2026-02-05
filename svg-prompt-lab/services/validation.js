/**
 * SVG validation for sprites, backgrounds, and props
 * Ported from server/middleware/validate.js
 */

const REQUIRED_SPRITE_ELEMENTS = [
  'eye-left-white', 'eye-right-white',
  'eye-left-pupil', 'eye-right-pupil',
  'brow-left', 'brow-right',
  'mouth-closed', 'mouth-open'
];

const REQUIRED_SPRITE_GROUPS = ['body', 'head-top', 'head-bottom'];

function hasId(svg, id) {
  return new RegExp(`id=["']${id}["']`).test(svg);
}

function extractYPosition(svg, elementId) {
  const cyMatch = svg.match(new RegExp(`id=["']${elementId}["'][^>]*cy=["']([\\d.]+)["']`));
  if (cyMatch) return parseFloat(cyMatch[1]);

  const pathMatch = svg.match(new RegExp(`id=["']${elementId}["'][^>]*d=["'][^"']*[\\s,]([\\d.]+)`));
  if (pathMatch) return parseFloat(pathMatch[1]);

  return null;
}

export function validateSprite(svg) {
  const errors = [];
  const warnings = [];

  if (!svg || typeof svg !== 'string') {
    return { valid: false, errors: ['SVG content is required'], warnings: [] };
  }

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

  // Required groups
  for (const group of REQUIRED_SPRITE_GROUPS) {
    if (!hasId(svg, group)) {
      errors.push(`Missing required group: ${group}`);
    }
  }

  // Required elements
  for (const element of REQUIRED_SPRITE_ELEMENTS) {
    if (!hasId(svg, element)) {
      errors.push(`Missing required element: ${element}`);
    }
  }

  // Pupil class check
  if (hasId(svg, 'eye-left-pupil') && !svg.match(/id=["']eye-left-pupil["'][^>]*class=["'][^"']*pupil/)) {
    warnings.push('eye-left-pupil should have class="pupil" for eye tracking');
  }
  if (hasId(svg, 'eye-right-pupil') && !svg.match(/id=["']eye-right-pupil["'][^>]*class=["'][^"']*pupil/)) {
    warnings.push('eye-right-pupil should have class="pupil" for eye tracking');
  }

  // mouth-open opacity check
  if (hasId(svg, 'mouth-open') && !svg.match(/id=["']mouth-open["'][^>]*opacity=["']0["']/)) {
    warnings.push('mouth-open should have opacity="0" initially');
  }

  // Mouth alignment check
  const mouthClosedY = extractYPosition(svg, 'mouth-closed');
  const mouthOpenY = extractYPosition(svg, 'mouth-open');
  if (mouthClosedY !== null && mouthOpenY !== null) {
    const diff = Math.abs(mouthClosedY - mouthOpenY);
    if (diff > 5) {
      warnings.push(`mouth-open and mouth-closed Y positions differ by ${diff.toFixed(1)} units`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateBackground(svg) {
  const errors = [];
  const warnings = [];

  if (!svg || typeof svg !== 'string') {
    return { valid: false, errors: ['SVG content is required'], warnings: [] };
  }

  if (!svg.includes('<svg')) {
    errors.push('Not a valid SVG (missing <svg> element)');
    return { valid: false, errors, warnings };
  }

  const viewBoxMatch = svg.match(/viewBox=["']([^"']+)["']/);
  if (!viewBoxMatch) {
    errors.push('Missing viewBox attribute');
  } else {
    const vb = viewBoxMatch[1];
    if (vb !== '0 0 400 225' && vb !== '0 0 225 400') {
      warnings.push(`ViewBox is "${vb}", expected "0 0 400 225" (landscape) or "0 0 225 400" (portrait)`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateProp(svg) {
  const errors = [];
  const warnings = [];

  if (!svg || typeof svg !== 'string') {
    return { valid: false, errors: ['SVG content is required'], warnings: [] };
  }

  if (!svg.includes('<svg')) {
    errors.push('Not a valid SVG (missing <svg> element)');
    return { valid: false, errors, warnings };
  }

  const viewBoxMatch = svg.match(/viewBox=["']([^"']+)["']/);
  if (!viewBoxMatch) {
    errors.push('Missing viewBox attribute');
  } else if (viewBoxMatch[1] !== '0 0 100 100') {
    warnings.push(`ViewBox is "${viewBoxMatch[1]}", expected "0 0 100 100"`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate SVG based on asset type
 */
export function validateSvg(svg, assetType) {
  switch (assetType) {
    case 'sprite': return validateSprite(svg);
    case 'background': return validateBackground(svg);
    case 'prop': return validateProp(svg);
    default: return { valid: true, errors: [], warnings: [`Unknown asset type: ${assetType}`] };
  }
}
