import fs from 'fs/promises';
import path from 'path';
import { DATA_DIR } from '../config.js';

const EXPERIMENTS_DIR = path.join(DATA_DIR, 'experiments');

/**
 * Get top-rated results across all experiments
 */
export async function getTopResults(filters = {}) {
  await fs.mkdir(EXPERIMENTS_DIR, { recursive: true });
  const files = await fs.readdir(EXPERIMENTS_DIR);
  const rated = [];

  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const data = JSON.parse(await fs.readFile(path.join(EXPERIMENTS_DIR, f), 'utf-8'));
      if (!data.results) continue;

      for (const result of data.results) {
        if (!result?.rating?.score) continue;

        // Apply filters
        if (filters.assetType) {
          const template = data.config?.templateIds?.[0];
          // Can't filter without template info, include it
        }
        if (filters.model && result.model !== filters.model) continue;
        if (filters.backend && result.backend !== filters.backend) continue;
        if (filters.minScore && result.rating.score < filters.minScore) continue;

        rated.push({
          experimentId: data.id,
          experimentName: data.name,
          index: result.index,
          model: result.model,
          backend: result.backend,
          variableValues: result.variableValues,
          rating: result.rating,
          validation: result.validation,
          latencyMs: result.latencyMs,
          hasSvg: !!result.response?.svg
        });
      }
    } catch { /* skip */ }
  }

  // Sort by score descending, winners first
  rated.sort((a, b) => {
    if (a.rating.winner && !b.rating.winner) return -1;
    if (!a.rating.winner && b.rating.winner) return 1;
    return (b.rating.score || 0) - (a.rating.score || 0);
  });

  return rated.slice(0, filters.limit || 50);
}
