export type HubDriveSettings={domain:string;knownDomains:string[]};
export const defaultHubDrive:HubDriveSettings={domain:'hubdrive.bar',knownDomains:['hubdrive.bar','hubdrive.pw']};
export function parseHubDriveDomain(input:string){
 if(typeof input!=='string'||input.length>253)throw new Error('Enter a HubDrive domain, for example hubdrive.pw or .pw.');
 let value=input.trim().toLowerCase();if(value.startsWith('.'))value='hubdrive'+value;
 if(value.startsWith('https://'))value=value.slice(8).replace(/\/$/,'');
 if(!/^hubdrive\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z]{2,63}$/.test(value))throw new Error('Use a HubDrive domain such as hubdrive.pw or .pw, without a path or port.');
 return value;
}
export function normalizeHubDriveLink(value:string,settings:HubDriveSettings){
 try{const url=new URL(value);if(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&settings.knownDomains.includes(url.hostname)){url.hostname=settings.domain;return url.href;}}catch{}
 return value;
}
