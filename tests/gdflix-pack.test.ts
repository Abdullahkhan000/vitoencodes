import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {gdflixPackUrl,parseGdflixPack,fetchGdflixPack} from '../lib/gdflix-pack.ts';
import {parseBulkLinks} from '../lib/bulk-links.ts';
import {importBulkLinks} from '../lib/bulk-store.ts';
import {listReleases,updateRelease} from '../lib/store.ts';
const pack='https://new7.gdflix.io/pack/8t1alVhipa';
test('GDFlix pack URLs stay on the supported HTTPS pack hosts',()=>{assert.equal(gdflixPackUrl(pack).pathname,'/pack/8t1alVhipa');for(const url of ['http://new7.gdflix.io/pack/x','https://evil.example/pack/x','https://new7.gdflix.io.evil.example/pack/x','https://user:pass@new7.gdflix.io/pack/x','https://new7.gdflix.io/file/x','https://new7.gdflix.io/pack/x?redirect=1'])assert.throws(()=>gdflixPackUrl(url));});
test('table packs extract exact filenames, sizes and individual links without executing scripts or mixing files',()=>{
 const html='<script><a href="/file/fake">Fake.2024.mkv</a>5 GB</script><table><TR><td>1</td><td>Movie.&amp;.2024.1080p.VITO.mkv</td><td>4.25 GB</td><td><a href="/file/AbC123">Download</a></td></TR><tr><td>Other.2023.720p.mkv</td><td>900 MB</td><td><a href="/file/XyZ456">Open</a></td></tr></table><a href="https://evil.example/file/bad">Ad.2025.mkv</a>2 GB';
 const result=parseGdflixPack(html,pack);assert.equal(result.entries.length,2);assert.equal(result.fileLinks,2);assert.equal(result.entries[0].filename,'Movie.&.2024.1080p.VITO.mkv');assert.equal(result.entries[0].size,'4.25 GB');assert.equal(result.entries[1].size,'900 MB');assert.equal(result.entries[1].encoder,'Unknown');assert.equal(result.entries[0].provider,'GDFlix');assert.equal(result.entries[0].url,'https://new7.gdflix.io/file/AbC123');
});
test('simple filename anchors are supported, unreadable entries are reported and adjacent filenames are not guessed',()=>{
 const result=parseGdflixPack('<a href="/file/A">Dune.2021.VITO.mkv</a> 5 GB <a href="/file/A">Duplicate</a><a href="/file/B">Missing.2024.mkv</a><div>Next.2025.mkv 7 GB</div><a href="/file/C">Download</a>',pack);assert.equal(result.entries.length,1);assert.equal(result.warningCount,2);
});
test('pack fetching rejects failed or empty pages and disables redirects',async()=>{
 const html='<a href="/file/A">Dune.2021.VITO.mkv</a> 5 GB';const result=await fetchGdflixPack(pack,async(input,options)=>{assert.equal(String(input),pack);assert.equal(options?.redirect,'error');return new Response(html);});assert.equal(result.entries.length,1);await assert.rejects(()=>fetchGdflixPack(pack,async()=>new Response('private',{status:403})),/HTTP 403/);await assert.rejects(()=>fetchGdflixPack(pack,async()=>new Response('<p>Sign in</p>')),/No readable/);
});
test('GDFlix imports preserve existing content, use their provider label and are idempotent',async ()=>{
 process.env.DATA_DIRECTORY=mkdtempSync(path.join(os.tmpdir(),'vito-gdflix-'));const text='Dune.2021.VITO.mkv - 5 GB\nhttps://new7.gdflix.io/file/AbC';const entries=parseBulkLinks(text);assert.equal((await importBulkLinks(entries)).created,1);const row=(await listReleases())[0];assert.equal(row.links[0].label,'GDFlix');(await updateRelease(row.id,'Curated Dune',row.links,'published'));assert.equal((await importBulkLinks(entries)).unchanged,1);assert.equal((await listReleases())[0].title,'Curated Dune');assert.equal((await listReleases())[0].status,'published');
});

test('saved GDFlix list rows keep inline bracketed sizes and optional duplicate-filename mirrors',()=>{
 const html='<li><a href="/file/A">Dune.2021.VITO.mkv [5.2GB]</a></li><li><a href="/file/B">Dune.2021.VITO.mkv [5.2GB]</a></li>';assert.equal(parseGdflixPack(html,pack).entries.length,1);const all=parseGdflixPack(html,pack,{keepDuplicateFilenames:true});assert.equal(all.entries.length,2);assert.equal(all.warningCount,0);assert.equal(all.entries[0].size,'5.2 GB');
});
