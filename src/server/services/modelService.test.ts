import { describe, expect, it } from 'vitest';
import { normalizeModelName } from './modelService.js';

describe('normalizeModelName', () => {
  it('converts to lowercase', () => {
    expect(normalizeModelName('Deepseek-v3.2')).toBe('deepseek-v3.2');
    expect(normalizeModelName('GPT-4o')).toBe('gpt-4o');
  });

  it('replaces hyphens between digits with dots', () => {
    expect(normalizeModelName('kimi-2-5')).toBe('kimi-2.5');
    expect(normalizeModelName('claude-3-5-sonnet')).toBe('claude-3.5-sonnet');
  });

  it('unifies different formats of the same model', () => {
    expect(normalizeModelName('kimi-2-5')).toBe(normalizeModelName('kimi-2.5'));
    expect(normalizeModelName('Deepseek-v3.2')).toBe(normalizeModelName('deepseek-v3.2'));
  });

  it('preserves hyphens that are not between digits', () => {
    expect(normalizeModelName('gpt-4o-mini')).toBe('gpt-4o-mini');
    expect(normalizeModelName('gpt-4-turbo')).toBe('gpt-4-turbo');
  });

  it('trims whitespace', () => {
    expect(normalizeModelName('  kimi-2.5  ')).toBe('kimi-2.5');
  });

  it('handles already-normalized names', () => {
    expect(normalizeModelName('deepseek-v3.2')).toBe('deepseek-v3.2');
    expect(normalizeModelName('kimi-2.5')).toBe('kimi-2.5');
  });
});
