import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {classifySource} from '../lib/encode-source.ts';
import {addRelease,listReleases,updateRelease} from '../lib/store.ts';
import {encodeSpecs} from '../lib/movie-details.ts';
test('source categories recognize release tags and normalize WEBRip to WEB-DL',()=>{
 for(const tag of ['BluRay','BLURAY','Blu-Ray','Blu.Ray','Blu Ray','bluray'])assert.equal(classifySource(`Movie.2020.1080p.${tag}.VITO.mkv`),'Blu-Ray');
 for(const tag of ['WEB-DL','WEB.DL','WEB_DL','WEBDL','WEBRip','WEB-Rip','web-rip','web rip'])assert.equal(classifySource(`Movie.2020.${tag}.VITO.mkv`),'WEB-DL');
 for(const tag of ['HDTV','hdtv','HD-TV'])assert.equal(classifySource(`Movie.2020.${tag}.VITO.mkv`),'HDTV');
 assert.equal(classifySource('Movie.2020.BluRay.WEB-DL.VITO.mkv'),'Blu-Ray');
 assert.equal(classifySource('Movie.2020.HDTV.WEBRip.VITO.mkv'),'HDTV');
 for(const filename of ['Movie.2020.VITO.mkv','The.Web.2020.1080p.VITO.mkv','Movie.NotBluRay.2020.VITO.mkv','Movie.2020.WEBRipper.VITO.mkv'])assert.equal(classifySource(filename),'Unknown');
});
test('existing catalog records gain source classification without changing format or mirrors',async ()=>{
 process.env.DATA_DIRECTORY=mkdtempSync(path.join(tmpdir(),'vito-source-'));
 (await addRelease({id:'br',filename:'Movie.2020.IMAX.BluRay.VITO.mkv',title:'Movie',year:2020,category:'IMAX',resolution:'1080p',size:'2 GB'}));
 (await addRelease({id:'web',filename:'Movie.2020.Open.Matte.WEBRip.VITO.mkv',title:'Movie',year:2020,category:'Open Matte',resolution:'1080p',size:'1 GB'}));
 (await updateRelease('br','Movie',[{label:'Mirror',url:'https://example.com/file'}],'published'));
 const rows=(await listReleases());const br=rows.find(r=>r.id==='br')!,web=rows.find(r=>r.id==='web')!;
 assert.equal(br.source,'Blu-Ray');assert.equal(br.category,'IMAX');assert.equal(br.links.length,1);assert.equal(br.status,'published');assert.equal(br.size,'2 GB');
 assert.equal(web.source,'WEB-DL');assert.equal(web.category,'Open Matte');assert.equal(web.status,'draft');assert.equal((await listReleases(true)).length,1);
 assert.equal(encodeSpecs(web.filename).source,'WEB-DL');
});
