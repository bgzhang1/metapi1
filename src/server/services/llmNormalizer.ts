import { fetch } from 'undici';
import { config } from '../config.js';

const LLM_NORMALIZE_TIMEOUT_MS = 30_000;

/** In-memory cache: lowercased raw name → LLM-normalized canonical name. */
const cache = new Map<string, string>();

export function isLlmNormalizerConfigured(): boolean {
  const { baseUrl, apiKey, model } = config.normalizeLlm;
  return !!(baseUrl && apiKey && model);
}

/**
 * Look up an LLM-normalized name from the cache.
 * Returns `undefined` when the name has not been normalized by an LLM yet.
 */
export function getCachedNormalizedName(name: string): string | undefined {
  return cache.get(name.trim().toLowerCase());
}

/**
 * Batch-normalise a list of model names by calling a configured LLM.
 *
 * Returns a `Map<original, normalised>` for every name that was successfully
 * normalized.  Names already in the cache are returned instantly.
 * If the LLM is not configured or the call fails, the returned map will
 * only contain previously-cached entries.
 */
export async function normalizeModelNamesWithLLM(
  names: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const uncached: string[] = [];

  for (const name of names) {
    const key = name.trim().toLowerCase();
    const hit = cache.get(key);
    if (hit !== undefined) {
      result.set(name, hit);
    } else {
      uncached.push(name);
    }
  }

  if (uncached.length === 0 || !isLlmNormalizerConfigured()) {
    return result;
  }

  try {
    const mapping = await callLlmForNormalization(uncached);
    for (const [original, normalized] of mapping.entries()) {
      const cacheKey = original.trim().toLowerCase();
      cache.set(cacheKey, normalized);
      result.set(original, normalized);
    }
  } catch {
    // LLM call failed – caller will fall back to regex.
  }

  return result;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildPrompt(names: string[]): string {
  const list = names.map((n) => `- ${n}`).join('\n');
  return [
    'You are a model name normalizer for AI / LLM model names.',
    'Given the following list, normalize each name to its canonical form.',
    '',
    'Rules:',
    '- Convert to lowercase.',
    '- Use dots for version separators between digits (e.g. "claude-3-5-sonnet" → "claude-3.5-sonnet", "kimi-2-5" → "kimi-2.5").',
    '- Preserve non-version hyphens (e.g. "gpt-4o-mini" stays "gpt-4o-mini").',
    '- Trim whitespace.',
    '- If two names clearly refer to the same model, map them to the same canonical name.',
    '',
    'Input model names:',
    list,
    '',
    'Respond ONLY with a JSON object mapping each input name (exactly as given) to its normalized form. No additional text.',
    'Example: {"Claude-3-5-Sonnet": "claude-3.5-sonnet", "GPT-4o": "gpt-4o"}',
  ].join('\n');
}

async function callLlmForNormalization(
  names: string[],
): Promise<Map<string, string>> {
  const { baseUrl, apiKey, model } = config.normalizeLlm;
  const url = `${baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_NORMALIZE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a model name normalizer. Respond only with valid JSON.' },
          { role: 'user', content: buildPrompt(names) },
        ],
        temperature: 0,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`LLM normalization HTTP ${response.status}`);
    }

    const data = (await response.json()) as any;
    const content: string = data?.choices?.[0]?.message?.content ?? '';
    return parseNormalizationResponse(content, names);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse the LLM response into a Map.  Only keys that were actually requested
 * are included, and values must be non-empty strings.
 */
function parseNormalizationResponse(
  content: string,
  requestedNames: string[],
): Map<string, string> {
  const result = new Map<string, string>();
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return result;

    const parsed = JSON.parse(jsonMatch[0]);
    const requestedSet = new Set(requestedNames);

    for (const [key, value] of Object.entries(parsed)) {
      if (requestedSet.has(key) && typeof value === 'string' && value.trim().length > 0) {
        result.set(key, value.trim());
      }
    }
  } catch {
    // Invalid JSON – return empty mapping.
  }
  return result;
}

// ---------------------------------------------------------------------------
// Testing helpers – exported only for unit tests.
// ---------------------------------------------------------------------------

/** @internal */
export function _testResetCache(): void {
  cache.clear();
}

/** @internal */
export { parseNormalizationResponse as _testParseResponse };
