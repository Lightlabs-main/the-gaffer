/**
 * Anthropic SDK singleton — server-only.
 *
 * Phase 6's AI Manager (lib/manager.ts) and the future event-narration
 * uses (Phase 7) all share this client. Keeping it module-singleton avoids
 * spinning up a new HTTP connection pool per request.
 */
import Anthropic from '@anthropic-ai/sdk'
import { env } from './env'

let _client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (_client) return _client
  _client = new Anthropic({ apiKey: env.anthropicKey() })
  return _client
}

/**
 * Pinned model id. The user spec mandates Claude Sonnet 4.6 for the
 * Hackathon submission — do not silently fall back to other models.
 */
export const MANAGER_MODEL = 'claude-sonnet-4-6'
