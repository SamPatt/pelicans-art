import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from svg-prompt-lab/ first (takes precedence), then parent .env for shared keys
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Use SVG_LAB_PORT to avoid conflict with parent project's PORT
export const PORT = process.env.SVG_LAB_PORT || 3100;
export const DATA_DIR = path.join(__dirname, 'data');
export const PARENT_SRC = path.join(__dirname, '..', 'src');

// OpenRouter
export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// OpenClaw
export const OPENCLAW_URL = process.env.OPENCLAW_URL || 'http://127.0.0.1:18789';
export const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN;
export const OPENCLAW_AGENT_ID = process.env.OPENCLAW_AGENT_ID || 'skitkit';
