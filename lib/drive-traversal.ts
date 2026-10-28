export type DriveEntry = { id: string; name: string; mimeType: string; size?: string };

/** Walk only real descendant folders. Drive shortcuts are deliberately excluded. */
export async function scanDriveTree({ folders, accessToken, onFile, request = fetch }: {
  folders: string[];
  accessToken: string;
  onFile: (file: DriveEntry) => void | Promise<void>;
  request?: typeof fetch;
}) {
  if (!folders.length || folders.some(id => !/^[\w-]+$/.test(id))) {
    throw new Error('Set valid DRIVE_FOLDER_IDS first.');
  }
  const queue = [...new Set(folders)];
  const queued = new Set(queue);
  const seenFiles = new Set<string>();
  let scanned = 0;
  for (let index = 0; index < queue.length; index++) {
    const folder = queue[index];
    let page = '';
    const pageTokens = new Set<string>();
    do {
      const params = new URLSearchParams({
        q: `'${folder}' in parents and trashed = false`,
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
        fields: 'nextPageToken,incompleteSearch,files(id,name,mimeType,size)',
        pageSize: '1000',
      });
      if (page) params.set('pageToken', page);
      const response = await request('https://www.googleapis.com/drive/v3/files?' + params, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`Drive scan failed (${response.status}). Check folder permissions. Earlier imports remain drafts; retry after fixing access.`);
      const data = await response.json() as { files?: DriveEntry[]; nextPageToken?: string; incompleteSearch?: boolean };
      if (data.incompleteSearch) throw new Error('Drive returned an incomplete search. Retry the scan; earlier imports remain drafts.');
      for (const file of data.files || []) {
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          if (!queued.has(file.id)) { queued.add(file.id); queue.push(file.id); }
          continue;
        }
        if (file.mimeType === 'application/vnd.google-apps.shortcut' || seenFiles.has(file.id)) continue;
        seenFiles.add(file.id);
        scanned++;
        await onFile(file);
      }
      page = data.nextPageToken || '';
      if (page && pageTokens.has(page)) throw new Error('Drive returned a repeated page token. Retry the scan.');
      if (page) pageTokens.add(page);
    } while (page);
  }
  return { scanned, foldersScanned: queue.length };
}
