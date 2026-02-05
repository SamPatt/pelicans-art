import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { listTemplates, getTemplate, saveTemplate, deleteTemplate } from '../services/templates.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const templates = await listTemplates();
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const template = await getTemplate(req.params.id);
    res.json(template);
  } catch (err) {
    res.status(err.status || 500).json({ error: true, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const template = {
      id: req.body.id || uuidv4(),
      ...req.body
    };
    const saved = await saveTemplate(template);
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const template = { ...req.body, id: req.params.id };
    const saved = await saveTemplate(template);
    res.json(saved);
  } catch (err) {
    res.status(err.status || 500).json({ error: true, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await deleteTemplate(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: true, message: err.message });
  }
});

export default router;
