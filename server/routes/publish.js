import { Router } from 'express';
import {
  getSkit,
  listPublished,
  getPublished,
  deletePublished
} from '../services/storage.js';
import { publishSkit } from '../services/publisher.js';

const router = Router();

/**
 * GET /api/publish
 * List all published skits
 */
router.get('/', async (req, res, next) => {
  try {
    const published = await listPublished();
    res.json(published);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/publish/:id
 * Get published skit JSON
 */
router.get('/:id', async (req, res, next) => {
  try {
    const published = await getPublished(req.params.id);
    res.json(published);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/publish/:skitId
 * Publish a skit to self-contained JSON
 */
router.post('/:skitId', async (req, res, next) => {
  try {
    const { skitId } = req.params;

    // Get the skit data
    const skit = await getSkit(skitId);

    // Get WebSocket server for progress broadcasts
    const wss = req.app.get('wss');

    // Progress callback that broadcasts to WebSocket clients
    const onProgress = (progress) => {
      if (wss?.broadcast) {
        wss.broadcast({
          type: 'publish:progress',
          skitId,
          ...progress
        });
      }
    };

    // Publish the skit
    const result = await publishSkit(skitId, skit, onProgress);

    // Broadcast completion
    if (wss?.broadcast) {
      wss.broadcast({
        type: 'publish:complete',
        skitId,
        url: result.url,
        size: result.size
      });
    }

    res.json(result);
  } catch (err) {
    // Broadcast error
    const wss = req.app.get('wss');
    if (wss?.broadcast) {
      wss.broadcast({
        type: 'publish:error',
        skitId: req.params.skitId,
        error: err.message
      });
    }
    next(err);
  }
});

/**
 * DELETE /api/publish/:id
 * Delete published skit
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await deletePublished(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
