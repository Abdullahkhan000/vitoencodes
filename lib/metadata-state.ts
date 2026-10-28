import type {Release} from './store.ts';
export function hasSavedMovieInfo(row:Pick<Release,'poster'|'details'>){
 return Boolean(row.details?.metadataFetchedAt||(row.poster&&row.details?.synopsis?.trim()&&row.details?.genres?.trim()));
}
