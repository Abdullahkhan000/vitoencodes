import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detectEncoder} from '../lib/encoder.ts';
import {parseFilename} from '../lib/parser.ts';
test('encoder detection uses complete tags and unbranded manual parsing does not relax Drive defaults',()=>{
 for(const name of ['Movie.2024.ViTO.mkv','Movie.2024.VITO (1).mkv'])assert.equal(detectEncoder(name),'VITO');
 for(const name of ['Movie.2024.VITOENCODES.mkv','Movie.2024.vitoencodes (1).mkv'])assert.equal(detectEncoder(name),'VITOENCODES');
 for(const name of ['Movie.2024.mkv','Movie.2024.NOTVITO.mkv','VitoCorleone.2024.mkv'])assert.equal(detectEncoder(name),'Unknown');
 assert.equal(parseFilename('Other.2024.mkv'),null);
 assert.equal(parseFilename('Other.2024.mkv',{requireBrand:false})?.title,'Other');
 assert.equal(parseFilename('Other.2024.txt',{requireBrand:false}),null);
});
