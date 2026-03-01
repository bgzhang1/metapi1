import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  _testParseResponse as parseResponse,
  _testResetCache as resetCache,
  getCachedNormalizedName,
  normalizeModelNamesWithLLM,
  isLlmNormalizerConfigured,
} from './llmNormalizer.js';

beforeEach(() => resetCache());
afterEach(() => resetCache());

describe('isLlmNormalizerConfigured', () => {
  it('returns false when env vars are empty', () => {
    expect(isLlmNormalizerConfigured()).toBe(false);
  });
});

describe('parseNormalizationResponse', () => {
  it('extracts valid mapping from clean JSON', () => {
    const json = '{"GPT-4o": "gpt-4o", "Claude-3-5-Sonnet": "claude-3.5-sonnet"}';
    const result = parseResponse(json, ['GPT-4o', 'Claude-3-5-Sonnet']);
    expect(result.get('GPT-4o')).toBe('gpt-4o');
    expect(result.get('Claude-3-5-Sonnet')).toBe('claude-3.5-sonnet');
  });

  it('extracts JSON embedded in surrounding text', () => {
    const text = 'Here is the result:\n{"kimi-2-5": "kimi-2.5"}\nDone.';
    const result = parseResponse(text, ['kimi-2-5']);
    expect(result.get('kimi-2-5')).toBe('kimi-2.5');
  });

  it('ignores keys not in the requested list', () => {
    const json = '{"GPT-4o": "gpt-4o", "extra": "value"}';
    const result = parseResponse(json, ['GPT-4o']);
    expect(result.size).toBe(1);
    expect(result.has('extra')).toBe(false);
  });

  it('returns empty map for invalid JSON', () => {
    const result = parseResponse('not json at all', ['foo']);
    expect(result.size).toBe(0);
  });

  it('skips non-string values', () => {
    const json = '{"GPT-4o": 123}';
    const result = parseResponse(json, ['GPT-4o']);
    expect(result.size).toBe(0);
  });

  it('trims whitespace in values', () => {
    const json = '{"GPT-4o": "  gpt-4o  "}';
    const result = parseResponse(json, ['GPT-4o']);
    expect(result.get('GPT-4o')).toBe('gpt-4o');
  });
});

describe('getCachedNormalizedName', () => {
  it('returns undefined for names not in cache', () => {
    expect(getCachedNormalizedName('unknown-model')).toBeUndefined();
  });
});

describe('normalizeModelNamesWithLLM (LLM not configured)', () => {
  it('returns only cached entries when LLM is not configured', async () => {
    const result = await normalizeModelNamesWithLLM(['gpt-4o', 'claude-3-5-sonnet']);
    // No LLM configured, no cache → empty map
    expect(result.size).toBe(0);
  });
});
