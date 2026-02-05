import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import { DATA_DIR } from '../config.js';
import { getTemplate } from './templates.js';
import { callBackend } from './backends.js';
import { validateSvg } from './validation.js';

const EXPERIMENTS_DIR = path.join(DATA_DIR, 'experiments');

// In-memory progress emitters per experiment
const progressEmitters = new Map();

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

function safePath(baseDir, id) {
  if (!id || typeof id !== 'string' || /[\/\\]/.test(id) || id.includes('..') || path.isAbsolute(id)) {
    const err = new Error(`Invalid ID: ${id}`);
    err.status = 400;
    throw err;
  }
  const resolved = path.join(baseDir, `${id}.json`);
  if (!resolved.startsWith(path.resolve(baseDir) + path.sep)) {
    const err = new Error(`Invalid path for ID: ${id}`);
    err.status = 400;
    throw err;
  }
  return resolved;
}

/**
 * Extract SVG from model response
 */
function extractSvg(content) {
  // Direct SVG tag
  const svgMatch = content.match(/<svg[\s\S]*?<\/svg>/i);
  if (svgMatch) return { svg: svgMatch[0], extractionError: null };

  // Inside code block
  const codeBlockMatch = content.match(/```(?:xml|svg|html)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    const inner = codeBlockMatch[1].trim();
    const innerMatch = inner.match(/<svg[\s\S]*?<\/svg>/i);
    if (innerMatch) return { svg: innerMatch[0], extractionError: null };
  }

  return { svg: null, extractionError: 'No SVG found in response' };
}

/**
 * Build prompt from template + variable values + examples
 */
function buildPrompt(template, variableValues, exampleSvgs) {
  let systemPrompt = template.systemPrompt;
  let userPrompt = template.userPromptTemplate;

  // Substitute variables
  for (const [key, value] of Object.entries(variableValues)) {
    userPrompt = userPrompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  // Inject examples into system prompt
  if (exampleSvgs && exampleSvgs.length > 0) {
    const exampleSection = exampleSvgs.map((ex, i) =>
      `\nEXAMPLE ${i + 1} (${ex.name}):\n${ex.svg}`
    ).join('\n');
    systemPrompt += `\n\nHere are example SVGs for reference:${exampleSection}`;
  }

  return { system: systemPrompt, user: userPrompt };
}

/**
 * Cartesian product of variable values
 */
function expandVariables(variables, overrides = {}) {
  const keys = Object.keys(variables);
  if (keys.length === 0) return [{}];

  const values = keys.map(k => {
    if (Object.hasOwn(overrides, k)) return Array.isArray(overrides[k]) ? overrides[k] : [overrides[k]];
    return variables[k].values || [''];
  });

  // Cartesian product
  const combos = [{}];
  for (let i = 0; i < keys.length; i++) {
    const newCombos = [];
    for (const combo of combos) {
      for (const val of values[i]) {
        newCombos.push({ ...combo, [keys[i]]: val });
      }
    }
    combos.length = 0;
    combos.push(...newCombos);
  }

  return combos;
}

/**
 * Promise pool: run tasks with limited concurrency
 */
async function promisePool(tasks, concurrency) {
  const results = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      results[index] = await tasks[index]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Run a single experiment cell
 */
async function runCell(template, modelConfig, variableValues, exampleSvgs, options) {
  const prompt = buildPrompt(template, variableValues, exampleSvgs);

  const messages = [
    { role: 'system', content: prompt.system },
    { role: 'user', content: prompt.user }
  ];

  const result = await callBackend(modelConfig.backend, modelConfig.model, messages, {
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    timeout: 120000
  });

  let svg = null;
  let extractionError = null;
  let validation = null;

  if (result.content) {
    const extracted = extractSvg(result.content);
    svg = extracted.svg;
    extractionError = extracted.extractionError;

    if (svg) {
      validation = validateSvg(svg, template.assetType);
    }
  }

  return {
    templateId: template.id,
    model: modelConfig.model,
    backend: modelConfig.backend,
    variableValues,
    promptSnapshot: { system: prompt.system, user: prompt.user },
    response: {
      raw: result.content,
      svg,
      extractionError
    },
    validation: validation || { valid: false, errors: [extractionError || result.error || 'No response'], warnings: [] },
    usage: result.usage,
    latencyMs: result.latencyMs,
    error: result.error,
    rating: null
  };
}

/**
 * Create and run an experiment
 */
export async function createExperiment(config) {
  const id = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const experiment = {
    id,
    name: config.name || 'Unnamed experiment',
    status: 'running',
    config,
    results: [],
    summary: { total: 0, completed: 0, failed: 0, validSvg: 0 },
    createdAt: new Date().toISOString(),
    completedAt: null
  };

  // Load templates
  const templates = [];
  for (const tid of config.templateIds) {
    templates.push(await getTemplate(tid));
  }

  // Load example SVGs if needed
  let exampleSvgs = [];
  if (config.exampleRefs && config.exampleRefs.length > 0) {
    // Examples are loaded by the frontend and passed in
    exampleSvgs = config.exampleRefs;
  }

  // Build the cell matrix
  const cells = [];
  for (const template of templates) {
    const combos = expandVariables(template.variables, config.variableOverrides);
    for (const combo of combos) {
      for (const modelConfig of config.models) {
        cells.push({ template, modelConfig, variableValues: combo });
      }
    }
  }

  experiment.summary.total = cells.length;

  // Save initial state
  await saveExperiment(experiment);

  // Setup progress emitter
  const emitter = new EventEmitter();
  progressEmitters.set(id, emitter);

  // Run cells concurrently
  const concurrency = config.concurrency || 3;
  let completedCount = 0;

  const tasks = cells.map((cell, index) => async () => {
    try {
      const result = await runCell(
        cell.template,
        cell.modelConfig,
        cell.variableValues,
        exampleSvgs.slice(0, config.exampleCount || 1),
        {
          temperature: Number.isFinite(config.temperature) ? config.temperature
            : Number.isFinite(cell.template.defaults?.temperature) ? cell.template.defaults.temperature : 0.7,
          maxTokens: Number.isFinite(config.maxTokens) ? config.maxTokens
            : Number.isFinite(cell.template.defaults?.maxTokens) ? cell.template.defaults.maxTokens : 4096
        }
      );
      result.index = index;
      experiment.results[index] = result;
      experiment.summary.completed++;
      if (result.response.svg && result.validation?.valid) {
        experiment.summary.validSvg++;
      }
    } catch (err) {
      experiment.results[index] = {
        index,
        templateId: cell.template.id,
        model: cell.modelConfig.model,
        backend: cell.modelConfig.backend,
        variableValues: cell.variableValues,
        error: err.message,
        response: { raw: null, svg: null, extractionError: null },
        validation: { valid: false, errors: [err.message], warnings: [] },
        usage: null,
        latencyMs: 0,
        rating: null
      };
      experiment.summary.failed++;
    }

    completedCount++;
    emitter.emit('progress', {
      type: 'cell-complete',
      index,
      completed: completedCount,
      total: cells.length,
      result: experiment.results[index]
    });

    // Incremental save every 5 completions
    if (completedCount % 5 === 0) {
      await saveExperiment(experiment);
    }
  });

  // Run in background
  promisePool(tasks, concurrency).then(async () => {
    experiment.status = 'completed';
    experiment.completedAt = new Date().toISOString();
    await saveExperiment(experiment);
    emitter.emit('progress', { type: 'complete', experiment });
    // Clean up emitter after a delay
    setTimeout(() => progressEmitters.delete(id), 60000);
  }).catch(async (err) => {
    experiment.status = 'failed';
    await saveExperiment(experiment);
    emitter.emit('progress', { type: 'error', error: err.message });
    setTimeout(() => progressEmitters.delete(id), 60000);
  });

  return experiment;
}

export function getProgressEmitter(id) {
  return progressEmitters.get(id);
}

async function saveExperiment(experiment) {
  const filePath = safePath(EXPERIMENTS_DIR, experiment.id);
  await fs.mkdir(EXPERIMENTS_DIR, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(experiment, null, 2));
}

export async function getExperiment(id) {
  const filePath = safePath(EXPERIMENTS_DIR, id);
  if (!await exists(filePath)) {
    const err = new Error(`Experiment not found: ${id}`);
    err.status = 404;
    throw err;
  }
  return JSON.parse(await fs.readFile(filePath, 'utf-8'));
}

export async function listExperiments() {
  await fs.mkdir(EXPERIMENTS_DIR, { recursive: true });
  const files = await fs.readdir(EXPERIMENTS_DIR);
  const experiments = [];

  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const data = JSON.parse(await fs.readFile(path.join(EXPERIMENTS_DIR, f), 'utf-8'));
      experiments.push({
        id: data.id,
        name: data.name,
        status: data.status,
        summary: data.summary,
        createdAt: data.createdAt,
        completedAt: data.completedAt
      });
    } catch { /* skip */ }
  }

  // Sort by creation date, newest first
  experiments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return experiments;
}

export async function deleteExperiment(id) {
  const filePath = safePath(EXPERIMENTS_DIR, id);
  if (!await exists(filePath)) {
    const err = new Error(`Experiment not found: ${id}`);
    err.status = 404;
    throw err;
  }
  await fs.unlink(filePath);
}

export async function updateResultRating(experimentId, resultIndex, rating) {
  const experiment = await getExperiment(experimentId);
  if (!experiment.results[resultIndex]) {
    const err = new Error(`Result ${resultIndex} not found`);
    err.status = 404;
    throw err;
  }
  experiment.results[resultIndex].rating = rating;
  await saveExperiment(experiment);
  return experiment.results[resultIndex];
}
