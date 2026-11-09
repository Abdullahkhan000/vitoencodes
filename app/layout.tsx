import {siteUrl} from '../lib/site-url';
import MobileNavigation from './components/mobile-navigation';
import './globals.css';
import './cinema.css';
export const metadata={metadataBase:new URL(siteUrl()),openGraph:{siteName:'VITOENCODES',type:'website'},twitter:{card:'summary_large_image' as const},title:'VITOENCODES — Cinema, preserved.',description:'The VITOENCODES cinema collection'};
expexport default function Layout({children}:{children:React.ReactNode}){
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="google-adsense-account" content="ca-pub-9525707589399873" />
      </head>
      <body>
        {children}
        <MobileNavigation/>
      </body>
    </html>
  );
}