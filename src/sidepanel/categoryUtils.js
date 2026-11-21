export function promptMatchesFolder(prompt, folderFilter) {
  if (folderFilter === 'all') return true;
  if (folderFilter === 'uncategorized') return !prompt?.folderId;
  return prompt?.folderId === folderFilter;
}

export function groupPromptsByFolder(prompts, folders, uncategorizedLabel) {
  const safePrompts = Array.isArray(prompts) ? prompts : [];
  const safeFolders = Array.isArray(folders) ? folders : [];
  const groupsById = new Map(safeFolders.map((folder) => [folder.id, {
    id: folder.id,
    name: folder.name,
    prompts: [],
  }]));
  const uncategorized = [];
  safePrompts.forEach((prompt) => {
    const group = prompt.folderId ? groupsById.get(prompt.folderId) : null;
    if (group) group.prompts.push(prompt);
    else uncategorized.push(prompt);
  });
  const groups = [...groupsById.values()].filter((group) => group.prompts.length > 0);
  if (uncategorized.length) {
    groups.push({ id: '', name: uncategorizedLabel, prompts: uncategorized });
  }
  return groups;
}
