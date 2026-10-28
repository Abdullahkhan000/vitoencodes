import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanDriveTree, type DriveEntry } from '../lib/drive-traversal.ts';
import { parseFilename } from '../lib/parser.ts';

const folder = (id: string): DriveEntry => ({ id, name: 'Movies', mimeType: 'application/vnd.google-apps.folder' });
const video = (id: string, name = 'Film.2024.1080p.VITOENCODES.mkv'): DriveEntry => ({ id, name, mimeType: 'video/x-matroska' });

test('nested scans paginate, deduplicate overlapping roots and stay inside real descendants', async () => {
  const calls: string[] = [];
  const imported = new Set<string>();
  let added = 0;
  const request = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://www.googleapis.com');
    assert.equal(url.searchParams.get('supportsAllDrives'), 'true');
    assert.equal(url.searchParams.get('includeItemsFromAllDrives'), 'true');
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-token');
    assert.ok(url.searchParams.get('fields')?.includes('mimeType'));
    const parent = url.searchParams.get('q')?.match(/^'([\w-]+)' in parents and trashed = false$/)?.[1];
    const key = `${parent}:${url.searchParams.get('pageToken') || ''}`;
    calls.push(key);
    switch (key) {
      case 'root:': return Response.json({ files: [video('root-video'), folder('child'), { id: 'shortcut', name: 'External.VITOENCODES.mkv', mimeType: 'application/vnd.google-apps.shortcut' }], nextPageToken: 'page-2' });
      case 'root:page-2': return Response.json({ files: [folder('child'), video('unbranded', 'Another.Movie.2024.mkv')] });
      case 'child:': return Response.json({ files: [folder('deep'), video('child-video'), video('root-video')] });
      case 'deep:': return Response.json({ files: [folder('root'), video('deep-video'), { id: 'notes', name: 'VITOENCODES.txt', mimeType: 'text/plain' }] });
      default: throw new Error('Unexpected traversal outside allowed descendants: ' + key);
    }
  }) as typeof fetch;
  const run = () => scanDriveTree({ folders: ['root', 'child', 'root'], accessToken: 'test-token', request, onFile(file) {
    if (parseFilename(file.name) && !imported.has(file.id)) { imported.add(file.id); added++; }
  } });
  const summary = await run();
  assert.deepEqual(summary, { scanned: 5, foldersScanned: 3 });
  assert.deepEqual(calls, ['root:', 'root:page-2', 'child:', 'deep:']);
  assert.deepEqual([...imported].sort(), ['child-video', 'deep-video', 'root-video']);
  assert.equal(added, 3);
  added = 0;
  await run();
  assert.equal(added, 0, 'repeat scans preserve source-ID deduplication');
});

test('access errors and incomplete listings fail explicitly', async () => {
  for (const response of [new Response(null, { status: 403 }), Response.json({ incompleteSearch: true })]) {
    await assert.rejects(scanDriveTree({ folders: ['root'], accessToken: 'test-token', onFile() {}, request: (async () => response) as typeof fetch }), /403|incomplete search/);
  }
});

test('repeated pagination tokens and invalid roots cannot loop or expand the search', async () => {
  await assert.rejects(scanDriveTree({ folders: ['root'], accessToken: 'test-token', onFile() {}, request: (async () => Response.json({ files: [], nextPageToken: 'same' })) as typeof fetch }), /repeated page token/);
  await assert.rejects(scanDriveTree({ folders: ["invalid'folder"], accessToken: 'test-token', onFile() {}, request: (async () => { throw new Error('must not fetch'); }) as typeof fetch }), /valid DRIVE_FOLDER_IDS/);
});
