import MobileNavigation from './components/mobile-navigation';
import './globals.css';
export const metadata={title:'VITOENCODES — Cinema, preserved.',description:'The VITOENCODES cinema collection'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><body>{children}<MobileNavigation/></body></html>}
