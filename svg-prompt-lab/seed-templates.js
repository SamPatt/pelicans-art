/**
 * Seed initial templates from the parent project's system prompts
 */
import { saveTemplate } from './services/templates.js';

const templates = [
  {
    id: 'sprite-default',
    name: 'Sprite Generator (Default)',
    assetType: 'sprite',
    systemPrompt: `You are an SVG character artist creating sprites for animated comedy skits.

CRITICAL STRUCTURE REQUIREMENTS:
- viewBox MUST be "0 0 100 150"
- All coordinates must fit within this viewBox

REQUIRED ELEMENT IDs (the animation system depends on these exact IDs):
- eye-left-white: Left eye white (ellipse)
- eye-right-white: Right eye white (ellipse)
- eye-left-pupil: Left pupil (circle, class="pupil")
- eye-right-pupil: Right pupil (circle, class="pupil")
- brow-left: Left eyebrow (path)
- brow-right: Right eyebrow (path)
- mouth-closed: Closed mouth shape (path)
- mouth-open: Open mouth shape (ellipse, initially opacity="0")

REQUIRED GROUPS:
- id="body": Torso, arms, legs
- id="head-top": Hair, forehead, eyes, brows
- id="head-bottom": Nose, jaw, mouth

ANATOMY REQUIREMENTS:
- HEAD-BODY CONNECTION: The head must be visually connected to the body. Do NOT draw a neck. Instead, ensure the head-bottom group overlaps or connects directly with the body group. No floating heads!
- MOUTH ALIGNMENT: mouth-open and mouth-closed MUST be at the EXACT same X and Y position. The open mouth replaces the closed mouth during speech - if they're misaligned, the mouth will appear to jump around during lip-sync.

STYLE GUIDELINES:
- Simple, flat cartoon style suitable for comedy
- Bold colors, clear shapes
- Expressive features that will animate well
- Character should face forward (front view)

OUTPUT FORMAT - You must respond with ONLY a valid SVG element. No JSON wrapping, no explanation, no markdown code blocks.
Output starts with: <svg viewBox="0 0 100 150" xmlns="http://www.w3.org/2000/svg">`,
    userPromptTemplate: '{{description}}',
    variables: {
      description: {
        description: 'What character to create',
        values: ['a friendly waiter in a vest and bow tie', 'an angry chef with a tall hat', 'a mysterious detective in a trench coat']
      }
    },
    examples: { count: 1, refs: ['waiter', 'person'] },
    defaults: { temperature: 0.7, maxTokens: 4096 }
  },
  {
    id: 'background-default',
    name: 'Background Generator (Landscape)',
    assetType: 'background',
    systemPrompt: `You are an SVG scene artist creating backgrounds for animated comedy skits.

REQUIRED DIMENSIONS - THIS IS CRITICAL:
- viewBox="0 0 400 225" (exactly 400 wide by 225 tall)
- This is a LANDSCAPE (wide/horizontal) background

STYLE:
- Simple, flat cartoon style
- Include background, midground, and foreground layers
- Leave space for characters at the bottom

Output ONLY a valid SVG element starting with:
<svg viewBox="0 0 400 225" xmlns="http://www.w3.org/2000/svg">

No explanation, no markdown code blocks.`,
    userPromptTemplate: 'Create a {{scene}} scene',
    variables: {
      scene: {
        description: 'Type of scene/location',
        values: ['cozy coffee shop', 'outer space with stars', 'medieval castle throne room', 'underwater coral reef']
      }
    },
    examples: { count: 0, refs: [] },
    defaults: { temperature: 0.7, maxTokens: 4096 }
  },
  {
    id: 'prop-default',
    name: 'Prop Generator (Default)',
    assetType: 'prop',
    systemPrompt: `You are an SVG artist creating props (objects/items) for animated comedy skits.

CRITICAL STRUCTURE REQUIREMENTS:
- viewBox MUST be "0 0 100 100"
- All coordinates must fit within this viewBox
- The prop should be centered in the viewBox

STYLE GUIDELINES:
- Simple, flat cartoon style matching the show's aesthetic
- Bold colors, clear shapes
- No complex gradients or effects
- Props should be recognizable at small sizes
- Objects should look good when held by characters

COMMON PROP TYPES:
- Food/drink: coffee cups, pizza slices, sandwiches
- Tools: hammers, wrenches, phones
- Weapons (cartoon): swords, ray guns, rubber chickens
- Everyday objects: books, keys, bags
- Symbolic items: hearts, stars, money bags

Output ONLY a valid SVG element starting with:
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">

No explanation, no markdown code blocks.`,
    userPromptTemplate: 'Create a {{item}}',
    variables: {
      item: {
        description: 'What prop/item to create',
        values: ['steaming coffee mug', 'cartoon ray gun', 'stack of gold coins', 'rubber chicken']
      }
    },
    examples: { count: 0, refs: [] },
    defaults: { temperature: 0.7, maxTokens: 4096 }
  }
];

async function seed() {
  console.log('Seeding templates...');
  for (const template of templates) {
    await saveTemplate(template);
    console.log(`  Created: ${template.id} (${template.name})`);
  }
  console.log('Done.');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
