export type Encoder='VITO'|'VITOENCODES'|'Unknown';
export function detectEncoder(filename:string):Encoder{
 const tag=/(?:^|[. _([\]-])(VITOENCODES|VITO)(?=$|[. _([\])-])/i.exec(filename)?.[1];
 return tag?tag.toUpperCase() as Exclude<Encoder,'Unknown'>:'Unknown';
}
