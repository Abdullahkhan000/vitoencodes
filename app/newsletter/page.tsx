import InfoShell from '../components/info-shell';
import ManageNewsletter from './manage';
export const metadata={title:'Release alerts | VITOENCODES',robots:{index:false,follow:false},referrer:'no-referrer' as const};
export default async function Newsletter({searchParams}:{searchParams:Promise<{confirm?:string;unsubscribe?:string}>}){
 const params=await searchParams,token=params.confirm||params.unsubscribe;
 return <InfoShell label="RELEASE ALERTS" title="Never miss the next encode." intro="Your inbox, your choice.">{token&&<ManageNewsletter token={token} action={params.confirm?'confirm':'unsubscribe'}/>}</InfoShell>;
}
