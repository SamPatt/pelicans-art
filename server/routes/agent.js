/**
 * Agent Routes - AI-assisted asset generation
 */

import { Router } from 'express';
import { generateAsset, checkOpenClawConnection } from '../services/agent.js';
import { saveSprite, getSprite, saveBackground, saveSkit } from '../services/storage.js';

const router = Router();

/**
 * GET /api/agent/status
 * Check OpenClaw connection status
 */
router.get('/status', async (req, res) => {
  const status = await checkOpenClawConnection();
  res.json(status);
});

/**
 * POST /api/agent/generate
 * Generate or modify an asset using AI
 *
 * Body:
 * {
 *   type: 'sprite' | 'prop' | 'background' | 'skit',
 *   mode: 'create' | 'edit',
 *   command: 'user instruction',
 *   current: { name, svg, meta } // for edit mode
 * }
 */
router.post('/generate', async (req, res, next) => {
  try {
    const { type, mode, command, current, orientation } = req.body;

    // Validate required fields
    if (!type || !['sprite', 'prop', 'background', 'skit'].includes(type)) {
      return res.status(400).json({
        error: true,
        message: 'Invalid type. Must be sprite, prop, background, or skit.'
      });
    }

    if (!mode || !['create', 'edit'].includes(mode)) {
      return res.status(400).json({
        error: true,
        message: 'Invalid mode. Must be create or edit.'
      });
    }

    if (!command || typeof command !== 'string' || command.trim().length === 0) {
      return res.status(400).json({
        error: true,
        message: 'Command is required.'
      });
    }

    if (mode === 'edit' && !current) {
      return res.status(400).json({
        error: true,
        message: 'Current asset state is required for edit mode.'
      });
    }

    // Generate the asset (pass orientation for backgrounds)
    const result = await generateAsset({ type, mode, command, current, orientation });

    // For edit mode with a name, save automatically and broadcast
    if (mode === 'edit' && current?.name && type === 'sprite') {
      // Merge spriteType into meta if provided by AI
      const updatedMeta = {
        ...(current.meta || {}),
        ...(result.spriteType ? { type: result.spriteType } : {})
      };

      await saveSprite(current.name, result.svg, updatedMeta);

      // Broadcast update via WebSocket
      const wss = req.app.get('wss');
      if (wss?.broadcast) {
        wss.broadcast({
          type: 'sprite:updated',
          name: current.name,
          sprite: { name: current.name, svg: result.svg, meta: updatedMeta }
        });
      }

      return res.json({
        success: true,
        saved: true,
        name: current.name,
        asset: result
      });
    }

    // For background edit mode, save automatically and broadcast
    if (mode === 'edit' && current?.name && type === 'background') {
      await saveBackground(current.name, result.svg);

      // Broadcast update via WebSocket
      const wss = req.app.get('wss');
      if (wss?.broadcast) {
        wss.broadcast({
          type: 'background:updated',
          name: current.name
        });
      }

      return res.json({
        success: true,
        saved: true,
        name: current.name,
        asset: result
      });
    }

    // For skit edit mode, save automatically and broadcast
    if (mode === 'edit' && current?.id && type === 'skit') {
      // Agent service returns { skit: {...} }, extract the skit object
      let skitData;
      try {
        skitData = result.skit || result;
        if (typeof skitData === 'string') {
          skitData = JSON.parse(skitData);
        }
      } catch (e) {
        return res.status(422).json({
          error: true,
          message: 'AI generated invalid skit data',
          parseError: true
        });
      }

      await saveSkit(current.id, skitData);

      // Broadcast update via WebSocket
      const wss = req.app.get('wss');
      if (wss?.broadcast) {
        wss.broadcast({
          type: 'skit:updated',
          skitId: current.id,
          skit: skitData
        });
      }

      return res.json({
        success: true,
        saved: true,
        id: current.id,
        asset: skitData
      });
    }

    // For create mode or background/skit, return without saving
    // (frontend will prompt for name and save separately)
    res.json({
      success: true,
      saved: false,
      asset: result
    });

  } catch (err) {
    console.error('[Agent] Generation error:', err);

    // Check for specific error types
    if (err.message.includes('OPENCLAW_TOKEN')) {
      return res.status(503).json({
        error: true,
        message: 'AI service not configured. Please set OPENCLAW_TOKEN in your environment.',
        configError: true
      });
    }

    if (err.message.includes('OpenClaw API error')) {
      return res.status(502).json({
        error: true,
        message: 'AI service error: ' + err.message,
        serviceError: true
      });
    }

    if (err.message.includes('No valid SVG') || err.message.includes('No valid JSON')) {
      return res.status(422).json({
        error: true,
        message: 'AI generated invalid output. Please try again with a different prompt.',
        parseError: true
      });
    }

    next(err);
  }
});

/**
 * POST /api/agent/generate/sprite
 * Convenience endpoint for sprite generation
 */
router.post('/generate/sprite', async (req, res, next) => {
  req.body.type = 'sprite';
  // Forward to main generate handler
  const generateHandler = router.stack.find(r => r.route?.path === '/generate')?.route?.stack[0]?.handle;
  if (generateHandler) {
    return generateHandler(req, res, next);
  }
  next();
});

/**
 * POST /api/agent/generate/background
 * Convenience endpoint for background generation
 */
router.post('/generate/background', async (req, res, next) => {
  req.body.type = 'background';
  const generateHandler = router.stack.find(r => r.route?.path === '/generate')?.route?.stack[0]?.handle;
  if (generateHandler) {
    return generateHandler(req, res, next);
  }
  next();
});

/**
 * POST /api/agent/generate/skit
 * Convenience endpoint for skit generation
 */
router.post('/generate/skit', async (req, res, next) => {
  req.body.type = 'skit';
  const generateHandler = router.stack.find(r => r.route?.path === '/generate')?.route?.stack[0]?.handle;
  if (generateHandler) {
    return generateHandler(req, res, next);
  }
  next();
});

export default router;
