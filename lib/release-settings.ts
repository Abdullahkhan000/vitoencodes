export const releaseFormats=['IMAX','Open Matte','35mm','Other'] as const;
export type ReleasePresentation={category?:string;primaryReleaseId?:string|null};
export class ReleaseSettingsError extends Error{}
export function validateReleasePresentation(input:ReleasePresentation):ReleasePresentation{
 const value:ReleasePresentation={};
 if(input.category!==undefined){
  if(typeof input.category!=='string'||!input.category.trim()||input.category.trim().length>60||/[\r\n]/.test(input.category))throw new ReleaseSettingsError('Choose a format of 1 to 60 characters.');
  const category=input.category.trim().replace(/\s+/g,' ');
  value.category=releaseFormats.find(format=>format.toLowerCase()===category.toLowerCase())||category;
 }
 if(input.primaryReleaseId!==undefined){
  if(input.primaryReleaseId!==null&&(typeof input.primaryReleaseId!=='string'||!input.primaryReleaseId.trim()||input.primaryReleaseId.length>500))throw new ReleaseSettingsError('Choose a valid main release or Automatic.');
  value.primaryReleaseId=input.primaryReleaseId;
 }
 return value;
}
