import test from 'node:test';
import assert from 'node:assert/strict';
import { getSlashCommandQuery, filterPromptsForSlashCommand } from '../src/utils/slashCommandUtils.js';

test('slash query is recognized only at the end of the text before the caret', () => {
  assert.equal(getSlashCommandQuery('draft text /rev'), 'rev');
  assert.equal(getSlashCommandQuery('/'), '');
  assert.equal(getSlashCommandQuery('not/a-command'), null);
  assert.equal(getSlashCommandQuery('draft /review more'), null);
});

test('slash command filters by prompt title, tag, and category while empty query shows all', () => {
  const prompts = [
    { uuid: 'review', title: 'Review code', tags: [], folderId: 'engineering' },
    { uuid: 'bug', title: 'Triage issue', tags: ['bug'], folderId: null },
    { uuid: 'feature', title: 'Write proposal', tags: [], folderId: 'feature' },
  ];
  const folders = [
    { id: 'engineering', name: 'Engineering Review' },
    { id: 'feature', name: 'Feature' },
  ];

  assert.deepEqual(filterPromptsForSlashCommand(prompts, folders, 'review').map(({ uuid }) => uuid), ['review']);
  assert.deepEqual(filterPromptsForSlashCommand(prompts, folders, 'bug').map(({ uuid }) => uuid), ['bug']);
  assert.deepEqual(filterPromptsForSlashCommand(prompts, folders, 'feat').map(({ uuid }) => uuid), ['feature']);
  assert.equal(filterPromptsForSlashCommand(prompts, folders, '').length, 3);
});
