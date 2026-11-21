import test from 'node:test';
import assert from 'node:assert/strict';
import { groupPromptsByFolder, promptMatchesFolder } from '../src/sidepanel/categoryUtils.js';

test('category filter matches all, uncategorized, and a selected category', () => {
  assert.equal(promptMatchesFolder({ folderId: 'review' }, 'all'), true);
  assert.equal(promptMatchesFolder({ folderId: null }, 'uncategorized'), true);
  assert.equal(promptMatchesFolder({ folderId: 'review' }, 'uncategorized'), false);
  assert.equal(promptMatchesFolder({ folderId: 'review' }, 'review'), true);
  assert.equal(promptMatchesFolder({ folderId: 'bug' }, 'review'), false);
});

test('prompts group by category and unknown categories remain visible as uncategorized', () => {
  const folders = [{ id: 'review', name: 'Review' }, { id: 'empty', name: 'Empty' }];
  const prompts = [
    { uuid: 'one', folderId: 'review' },
    { uuid: 'two', folderId: null },
    { uuid: 'three', folderId: 'deleted-category' },
  ];

  assert.deepEqual(groupPromptsByFolder(prompts, folders, 'Uncategorized'), [
    { id: 'review', name: 'Review', prompts: [prompts[0]] },
    { id: '', name: 'Uncategorized', prompts: [prompts[1], prompts[2]] },
  ]);
});
