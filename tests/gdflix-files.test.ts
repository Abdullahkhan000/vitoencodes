import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {savedGdflixPack,parseGdflixLinks,parseGdflixFile,cacheGdflixFiles,resolveGdflixLinks} from '../lib/gdflix-files.ts';
import {parseBulkLinks} from '../lib/bulk-links.ts';
import {importBulkLinks} from '../lib/bulk-store.ts';
import {listReleases} from '../lib/store.ts';
process.env.DATA_DIRECTORY=mkdtempSync(path.join(os.tmpdir(),'vito-gdflix-files-'));
const url='https://new7.gdflix.io/file/FileA';
const html='<title>GDFlix | Dune.2021.1080p.VITO.mkv</title><meta property="og:title" content="GDFlix | Dune.2021.1080p.VITO.mkv"><h3>Dune.2021.1080p.VITO.mkv</h3><ul><li>File Size : 5.2 GB</li></ul>';
test('GDFlix links-only accepts five individual URLs and rejects packs, duplicates and foreign hosts',()=>{
 assert.equal(parseGdflixLinks(url+'\nhttps://new7.gdflix.io/file/FileB').length,2);for(const value of ['',url+'\n'+url,'https://new7.gdflix.io/pack/Pack','https://evil.example/file/A','http://new7.gdflix.io/file/A',url+'?token=1',Array.from({length:6},(_,i)=>url+i).join('\n')])assert.throws(()=>parseGdflixLinks(value));
});
test('public file metadata yields actual filename and size; scripts and branded page-title prefixes do not create false matches',()=>{
 const entry=parseGdflixFile('<script><h3>Fake.2024.mkv</h3></script>'+html,url);assert.equal(entry.filename,'Dune.2021.1080p.VITO.mkv');assert.equal(entry.size,'5.2 GB');assert.equal(entry.year,2021);assert.equal(entry.provider,'GDFlix');assert.throws(()=>parseGdflixFile('<h3>First.2024.mkv</h3><h3>Other.2024.mkv</h3>File Size: 1 GB',url),/multiple filenames/);assert.throws(()=>parseGdflixFile('<h3>Dune.2021.mkv</h3>',url),/size/);
});
test('saved pack details resolve links without fetching or adding releases',async()=>{
 const entry=parseBulkLinks('Avatar.2009.1080p.VITO.mkv - 6 GB\nhttps://new7.gdflix.io/file/PackCached')[0];const before=(await listReleases()).length;(await cacheGdflixFiles([entry],'Saved pack'));const results=await resolveGdflixLinks(entry.url,async()=>{throw new Error('Unexpected fetch');});assert.equal(results[0].filename,entry.filename);assert.equal((await listReleases()).length,before);
});
test('unseen links resolve once, cache for Save and keep unknown/private file pages out of the catalog',async()=>{
 let calls=0;const request:typeof fetch=async(_,options)=>{calls++;assert.equal(options?.redirect,'error');return new Response(html);};const entries=await resolveGdflixLinks(url,request);await resolveGdflixLinks(url,request);assert.equal(calls,1);assert.equal(entries[0].title,'Dune');await assert.rejects(()=>resolveGdflixLinks('https://new7.gdflix.io/file/Private',async()=>new Response('Sign in',{status:403})),/HTTP 403/);assert.equal((await listReleases()).length,0);
});
test('two file links with the same filename save as one encode with two GDFlix mirrors',async()=>{
 const entries=parseBulkLinks('Same.Movie.2024.VITO.mkv - 3 GB\nhttps://new7.gdflix.io/file/MirrorA');const other={...entries[0],url:'https://new7.gdflix.io/file/MirrorB'};(await cacheGdflixFiles([...entries,other],'Saved pack'));const resolved=await resolveGdflixLinks(entries[0].url+'\n'+other.url,async()=>{throw new Error('Unexpected fetch');});const result=(await importBulkLinks(resolved));assert.equal(result.created,1);assert.equal(result.updated,1);assert.equal((await listReleases())[0].links.length,2);assert.ok((await listReleases())[0].links.every(link=>link.label==='GDFlix'));
});

test('saved pack lookup is scoped to its pack and preserves multiple mirrors',async ()=>{const entries=parseBulkLinks('Pack.Movie.2024.VITO.mkv - 3 GB\nhttps://new7.gdflix.io/file/SavedPackA');(await cacheGdflixFiles([...entries,{...entries[0],url:'https://new7.gdflix.io/file/SavedPackB'}],'Saved GDFlix pack listing: KnownPack'));const result=(await savedGdflixPack('https://new7.gdflix.io/pack/KnownPack'));assert.equal(result?.entries.length,2);assert.match(result!.warnings[0],/saved pack listing/);assert.equal((await savedGdflixPack('https://new7.gdflix.io/pack/OtherPack')),null);(await assert.rejects(async ()=>(await savedGdflixPack('https://evil.example/pack/KnownPack'))));});
