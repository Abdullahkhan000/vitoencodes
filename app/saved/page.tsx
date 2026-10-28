import InfoShell from '../components/info-shell';
import LibraryShelf from '../components/library-shelf';
import {listReleases} from '../../lib/store';
export const dynamic='force-dynamic';
export const metadata={title:'Saved movies | VITOENCODES',description:'Your saved movies in this browser.',robots:{index:false,follow:true}};
export default async function Saved(){return <InfoShell label="YOUR PERSONAL SHELF" title="Keep your next great frame." intro="The movies you bookmarked, together in one place. Saved movies stay in this browser on this device."><LibraryShelf mode="saved" initialReleases={(await listReleases(true))}/></InfoShell>;}
