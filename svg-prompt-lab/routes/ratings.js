import { Router } from 'express';
import { getTopResults } from '../services/ratings.js';

const router = Router();

router.get('/top', async (req, res) => {
  try {
    const filters = {
      model: req.query.model,
      backend: req.query.backend,
      minScore: req.query.minScore ? parseInt(req.query.minScore, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 50
    };
    const results = await getTopResults(filters);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

export default router;
