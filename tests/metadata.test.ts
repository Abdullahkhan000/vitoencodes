import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {identifyFilm,formatFileSize} from '../lib/film-metadata.ts';
import {addRelease,listReleases,setReleaseMetadata,refreshReleaseSize,updateRelease} from '../lib/store.ts';
test('film matching handles copy prefixes and title typos without choosing other sequels',()=>{
 assert.equal(identifyFilm('Copy of Mission Impossible : Ghost Protocol (2011) VITOENCODES.mkv',2011)?.key,'ghost-protocol');
 assert.equal(identifyFilm('Mission.Impossible-Dead.Reckoninig.Part.One.2023.VITOENCODES.mkv',2023)?.key,'dead-reckoning');
 assert.equal(identifyFilm('The Dark Knight REGRADED HYBRID REMUX IMAX VITOENCODES.mkv',null)?.year,2008);
 assert.equal(identifyFilm('The Dark Knight Rises.2012.VITOENCODES.mkv',null),null);
 assert.equal(identifyFilm('Mission.Impossible.VITOENCODES.mkv',null),null);
 assert.equal(identifyFilm('Superman.1978.VITOENCODES.mkv',1978),null);
 assert.equal(identifyFilm('Unknown.2024.VITOENCODES.mkv',2024),null);
});
test('file size labels use exact source bytes with honest binary units',()=>{assert.equal(formatFileSize(1073741824),'1.00 GiB');assert.equal(formatFileSize(1048576),'1.00 MiB');assert.equal(formatFileSize(0),'0 B');assert.equal(formatFileSize(NaN),'Unknown');});
test('artwork enrichment and size refresh preserve mirrors and publishing decisions',async ()=>{
 const previous=process.env.DATA_DIRECTORY;process.env.DATA_DIRECTORY=mkdtempSync(path.join(tmpdir(),'vito-artwork-test-'));
 try{(await addRelease({id:'drive:test',filename:'Copy of The.Dark.Knight.2008.VITOENCODES.mkv',title:'Copy of The Dark Knight',year:2008,category:'IMAX',resolution:'1080p',size:'Unknown'}));(await setReleaseMetadata('drive:test','The Dark Knight',2008,'/posters/imported/the-dark-knight.jpg','https://en.wikipedia.org/wiki/The_Dark_Knight'));assert.equal((await listReleases())[0].status,'draft');assert.equal((await listReleases(true)).length,0);(await updateRelease('drive:test','The Dark Knight',[{label:'Mirror',url:'https://example.com/encode'}],'published'));(await refreshReleaseSize('drive:test',1073741824,formatFileSize(1073741824)));const row=(await listReleases(true))[0];assert.equal(row.poster,'/posters/imported/the-dark-knight.jpg');assert.equal(row.title,'The Dark Knight');assert.equal(row.size_bytes,1073741824);assert.equal(row.size,'1.00 GiB');assert.equal(row.links[0].label,'Mirror');assert.equal(row.filename,'Copy of The.Dark.Knight.2008.VITOENCODES.mkv');}finally{if(previous===undefined)delete process.env.DATA_DIRECTORY;else process.env.DATA_DIRECTORY=previous;}
});
