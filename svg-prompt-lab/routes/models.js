import { Router } from 'express';
import { listModels } from '../services/backends.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const models = await listModels();
    res.json(models);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

export default router;
