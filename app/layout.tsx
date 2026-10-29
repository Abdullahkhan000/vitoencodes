import {siteUrl} from '../lib/site-url';
import MobileNavigation from './components/mobile-navigation';
import './globals.css';
export const metadata={metadataBase:new URL(siteUrl()),openGraph:{siteName:'VITOENCODES',type:'website'},twitter:{card:'summary_large_image' as const},title:'VITOENCODES — Cinema, preserved.',description:'The VITOENCODES cinema collection'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><body>{children}<MobileNavigation/></body></html>}
