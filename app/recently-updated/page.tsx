import InfoShell from '../components/info-shell';
import LibraryShelf from '../components/library-shelf';
import {listReleases} from '../../lib/store';
export const dynamic='force-dynamic';
export const metadata={title:'Recently updated encodes | VITOENCODES',description:'Published encodes with recorded changes to their release information or download mirrors.'};
export default async function Updated(){return <InfoShell label="THE ARCHIVE / REVISITED" title="A fresh look at your encodes." intro="Published releases with recorded changes to their details or mirrors, newest updates first. Original additions stay on the home page."><LibraryShelf mode="updated" initialReleases={(await listReleases(true))}/></InfoShell>;}
