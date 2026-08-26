import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load .env from project root (parent of server/)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Export configuration
export const TTS_URL = process.env.TTS_URL || 'http://127.0.0.1:8001';
export const PORT = process.env.PORT || 3000;
export const HOST = process.env.HOST || '127.0.0.1';
export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
export const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
export const OPENCLAW_URL = process.env.OPENCLAW_URL || 'http://127.0.0.1:18789';
export const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN;
export const OPENCLAW_AGENT_ID = process.env.OPENCLAW_AGENT_ID;
