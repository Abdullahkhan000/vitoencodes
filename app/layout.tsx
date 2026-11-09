import Script from 'next/script';
import {siteUrl} from '../lib/site-url';
import MobileNavigation from './components/mobile-navigation';
import './globals.css';
import './cinema.css';

export const metadata = {
  metadataBase: new URL(siteUrl()),
  openGraph: {
    siteName: 'VITOENCODES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image' as const,
  },
  title: 'VITOENCODES — Cinema, preserved.',
  description: 'The VITOENCODES cinema collection',
};

export default function Layout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta
          name="google-adsense-account"
          content="ca-pub-9525707589399873"
        />
      </head>

      <body>
        {children}

        <MobileNavigation />

        {/* Monetag MultiTag — Attractive */}
        <Script
          src="https://quge5.com/88/tag.min.js"
          data-zone="307860"
          async
          data-cfasync="false"
          strategy="afterInteractive"
        />

        {/* Monetag Vignette — Dreamy */}
        <Script
          id="monetag-vignette-12223922"
          strategy="afterInteractive"
        >
          {`
            (function(s) {
              s.dataset.zone = '12223922';
              s.src = 'https://n6wxm.com/vignette.min.js';
            })(
              [document.documentElement, document.body]
                .filter(Boolean)
                .pop()
                .appendChild(document.createElement('script'))
            );
          `}
        </Script>

        {/* Monetag In-Page Push — Skillful */}
        <Script
          id="monetag-inpage-12223911"
          strategy="afterInteractive"
        >
          {`
            (function(s) {
              s.dataset.zone = '12223911';
              s.src = 'https://nap5k.com/tag.min.js';
            })(
              [document.documentElement, document.body]
                .filter(Boolean)
                .pop()
                .appendChild(document.createElement('script'))
            );
          `}
        </Script>
      </body>
    </html>
  );
}