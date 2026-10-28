export function metadataProvider(){
 if(process.env.METADATA_PROVIDER==='tmdb')return 'TMDB';
 if(process.env.METADATA_PROVIDER==='linkify')return 'Linkify Media';
 return process.env.TMDB_API_KEY||process.env.TMDB_READ_ACCESS_TOKEN?'TMDB':'Linkify Media';
}
export function metadataConfigured(){return metadataProvider()==='TMDB'?Boolean(process.env.TMDB_API_KEY||process.env.TMDB_READ_ACCESS_TOKEN):Boolean(process.env.LINKIFY_MEDIA_API_KEY);}
