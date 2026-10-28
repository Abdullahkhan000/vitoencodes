import { parseFilename } from './parser';
import { addRelease, refreshReleaseSize } from './store';
import { formatFileSize } from './film-metadata';
import { scanDriveTree } from './drive-traversal';

export async function scanDrive() {
  const folders = (process.env.DRIVE_FOLDER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
  if (!folders.length || folders.some(id => !/^[\w-]+$/.test(id))) throw new Error('Set valid DRIVE_FOLDER_IDS first.');
  let access = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      const details = await response.json().catch(() => null);
      const knownErrors = ['invalid_grant', 'invalid_client', 'unauthorized_client', 'invalid_request', 'temporarily_unavailable'];
      const code = knownErrors.includes(details?.error) ? details.error : 'oauth_error';
      throw new Error('Google OAuth refresh failed (' + response.status + ', ' + code + '). Check server credentials.');
    }
    access = (await response.json()).access_token;
  }
  if (!access) throw new Error('Configure Google OAuth credentials first.');
  let added = 0;
  const counts = await scanDriveTree({
    folders,
    accessToken: access,
    async onFile(file) {
      const parsed = parseFilename(file.name);
      if (parsed && (await addRelease({
        ...parsed,
        id: 'drive:' + file.id,
        filename: file.name,
        size: file.size ? formatFileSize(Number(file.size)) : 'Unknown',
      }))) added++;
      if (parsed && file.size) (await refreshReleaseSize('drive:'+file.id,Number(file.size),formatFileSize(Number(file.size))));
    },
  });
  return { ...counts, added, status: 'draft', message: 'Allowed folders and nested subfolders scanned. Shortcuts skipped. No media transferred.' };
}
