export const encodeSources=['Blu-Ray','HDTV','WEB-DL'] as const;
export type EncodeSource=typeof encodeSources[number]|'Unknown';
// Source tags are independent of presentation formats such as IMAX or Open Matte.
export function classifySource(filename:string):EncodeSource{
 const boundary='(?:^|[.\\s_()\\[\\]-])',end='(?=$|[.\\s_()\\[\\]-])';
 if(new RegExp(boundary+'blu[.\\s_-]*ray'+end,'i').test(filename))return 'Blu-Ray';
 if(new RegExp(boundary+'hd[.\\s_-]*tv'+end,'i').test(filename))return 'HDTV';
 if(new RegExp(boundary+'web[.\\s_-]*(?:dl|rip)'+end,'i').test(filename))return 'WEB-DL';
 return 'Unknown';
}
