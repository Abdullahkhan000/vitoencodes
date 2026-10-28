import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {validateMovieDetails,youtubeEmbed,encodeSpecs} from '../lib/movie-details.ts';
import {addRelease,updateRelease,listReleases} from '../lib/store.ts';
test('movie content accepts bounded text and images, and restricts trailers to YouTube',()=>{
 const details=validateMovieDetails({synopsis:' A synopsis. ',screenshots:['https://example.com/frame.jpg','/screenshots/frame.jpg'],trailer:'https://youtu.be/dQw4w9WgXcQ'});
 assert.equal(details.synopsis,'A synopsis.');
 assert.equal(youtubeEmbed(details.trailer!),'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
 for(const trailer of ['javascript:alert(1)','https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ','https://example.com/video'])assert.throws(()=>validateMovieDetails({trailer}),/YouTube/);
 assert.throws(()=>validateMovieDetails({screenshots:['http://example.com/frame.jpg']}),/HTTPS/);
 assert.throws(()=>validateMovieDetails({screenshots:['/screenshots/../private']}),/HTTPS/);
 assert.throws(()=>validateMovieDetails({screenshots:Array(7).fill('https://example.com/a.jpg')}),/6 HTTPS/);
 assert.throws(()=>validateMovieDetails({synopsis:'x'.repeat(4001)}),/synopsis/);
});
test('media information derives known tags and leaves missing properties unspecified',()=>{
 const specs=encodeSpecs('Avatar.2009.1080p.BluRay.SDR.x265.10Bit.HEVC.Eng.DDP.Atmos.5.1.ViTO.mkv');
 assert.equal(specs.codec,'HEVC / x265');assert.equal(specs.bitDepth,'10-bit');assert.equal(specs.range,'SDR');assert.equal(specs.source,'Blu-Ray');assert.equal(specs.language,'English');assert.equal(specs.audio,'Dolby Digital Plus · Atmos · 5.1');
 assert.equal(encodeSpecs('Movie.2024.VITO.mkv').language,'Not specified');
 assert.equal(encodeSpecs('Movie.2024.VITO.mkv').audio,'Not specified');
});
test('movie content survives visibility and mirror changes without exposing drafts',async ()=>{
 process.env.DATA_DIRECTORY=mkdtempSync(path.join(tmpdir(),'vito-details-'));
 (await addRelease({id:'details-test',filename:'Movie.2024.VITO.mkv',title:'Movie',year:2024,category:'IMAX',resolution:'1080p',size:'1 GB'}));
 const content=validateMovieDetails({synopsis:'The overview.',director:'Director',cast:'One, Two',screenshots:['https://example.com/1.jpg']});
 const links=[{label:'HubDrive',url:'https://hubdrive.bar/file/123'}];
 (await updateRelease('details-test','Movie',links,'draft',content));
 assert.equal((await listReleases(true)).length,0);
 (await updateRelease('details-test','Movie updated',links,'published'));
 assert.deepEqual((await listReleases(true))[0].details,content);
 (await updateRelease('details-test','Movie updated',links,'draft'));
 assert.deepEqual((await listReleases())[0].details,content);
 assert.equal((await listReleases(true)).length,0);
});
