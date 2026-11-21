const SLASH_QUERY_PATTERN = /(?:^|\s)\/([a-z0-9_-]*)$/i;

export function getSlashCommandQuery(textBeforeCaret) {
  const match = String(textBeforeCaret || '').match(SLASH_QUERY_PATTERN);
  return match ? match[1].toLowerCase() : null;
}

function commandTerms(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return [];
  return [
    normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    ...normalized.split(/[^a-z0-9]+/).filter(Boolean),
  ];
}

export function filterPromptsForSlashCommand(prompts, folders, query) {
  const safePrompts = Array.isArray(prompts) ? prompts : [];
  const cleanQuery = String(query || '').trim().toLowerCase();
  if (!cleanQuery) return safePrompts;

  const folderNames = new Map((Array.isArray(folders) ? folders : []).map((folder) => [folder.id, folder.name]));
  return safePrompts.filter((prompt) => {
    const values = [prompt?.title, folderNames.get(prompt?.folderId)];
    if (Array.isArray(prompt?.tags)) values.push(...prompt.tags);
    return values
      .flatMap(commandTerms)
      .some((term) => term.startsWith(cleanQuery));
  });
}
