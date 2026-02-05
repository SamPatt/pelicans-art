import { Router } from 'express';
import {
  createExperiment, getExperiment, listExperiments,
  deleteExperiment, updateResultRating, getProgressEmitter
} from '../services/experiments.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const experiment = await createExperiment(req.body);
    res.status(201).json({ id: experiment.id, status: experiment.status, summary: experiment.summary });
  } catch (err) {
    res.status(err.status || 500).json({ error: true, message: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const experiments = await listExperiments();
    res.json(experiments);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const experiment = await getExperiment(req.params.id);
    res.json(experiment);
  } catch (err) {
    res.status(err.status || 500).json({ error: true, message: err.message });
  }
});

/**
 * SSE endpoint for experiment progress
 */
router.get('/:id/progress', (req, res) => {
  const emitter = getProgressEmitter(req.params.id);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  if (!emitter) {
    // Experiment may already be complete
    res.write(`data: ${JSON.stringify({ type: 'no-emitter', message: 'Experiment may already be complete' })}\n\n`);
    res.end();
    return;
  }

  const onProgress = (event) => {
    // Don't send full raw response in SSE to keep payloads small
    const lite = { ...event };
    if (lite.result) {
      lite.result = {
        index: lite.result.index,
        model: lite.result.model,
        backend: lite.result.backend,
        variableValues: lite.result.variableValues,
        validation: lite.result.validation,
        latencyMs: lite.result.latencyMs,
        error: lite.result.error,
        hasSvg: !!lite.result.response?.svg
      };
    }
    res.write(`data: ${JSON.stringify(lite)}\n\n`);

    if (event.type === 'complete' || event.type === 'error') {
      res.end();
    }
  };

  emitter.on('progress', onProgress);

  req.on('close', () => {
    emitter.off('progress', onProgress);
  });
});

router.delete('/:id', async (req, res) => {
  try {
    await deleteExperiment(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: true, message: err.message });
  }
});

router.put('/:id/results/:idx/rating', async (req, res) => {
  try {
    const result = await updateResultRating(
      req.params.id,
      parseInt(req.params.idx, 10),
      req.body
    );
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: true, message: err.message });
  }
});

export default router;
