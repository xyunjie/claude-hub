import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_CONFIG, mergeConfig } from '../dist/config.js';

test('empty input yields the defaults', () => {
  assert.deepEqual(mergeConfig({}), DEFAULT_CONFIG);
});

test('invalid values fall back and unknown keys drop', () => {
  const config = mergeConfig({
    theme: 'nope', language: 'fr', pathLevels: 9, bogus: 1,
    display: { showTools: 'yes', contextWarningThreshold: 150, mergeGroups: [['context']] },
  });
  assert.equal(config.theme, 'claude');
  assert.equal(config.language, 'en');
  assert.equal(config.pathLevels, 1);
  assert.equal('bogus' in config, false);
  assert.equal(config.display.showTools, false);
  assert.equal(config.display.contextWarningThreshold, 100);
  assert.deepEqual(config.display.mergeGroups, [['context', 'usage']]);
});

test('colors keep only valid roles and values', () => {
  const config = mergeConfig({ colors: { model: '#ff00ff', project: 300, git: 'pink', label: 'gray', barFilled: '▰', barEmptyChar: 'ab' } });
  assert.deepEqual(config.colors, { model: '#ff00ff', label: 'gray', barFilled: '▰' });
});

test('claude-hud display keys carry over', () => {
  const config = mergeConfig({ lineLayout: 'compact', display: { showTools: true, showAgents: true }, elementOrder: ['context', 'addedDirs', 'project'] });
  assert.equal(config.lineLayout, 'compact');
  assert.equal(config.display.showTools, true);
  assert.deepEqual(config.elementOrder, ['context', 'project']);
});
