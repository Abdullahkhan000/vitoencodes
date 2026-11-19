import Script from 'next/script';
import {siteUrl} from '../lib/site-url';
import MobileNavigation from './components/mobile-navigation';
import './globals.css';
import './cinema.css';

const baseUrl=siteUrl();

export const metadata = {
  metadataBase: new URL(baseUrl),
  openGraph: {
    siteName: 'VITOENCODES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image' as const,
  },
  title: 'VITOENCODES — Cinema, preserved.',
  description: 'An independent movie encode archive featuring alternate editions, curated releases and detailed technical specifications.',
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': baseUrl+'#organization',
  name: 'VITOENCODES',
  alternateName: 'VITO ENCODES',
  url: baseUrl,
  logo: baseUrl+'/icon.svg',
  description: 'An independent movie encode archive featuring alternate editions, curated releases and detailed technical specifications.',
  sameAs: [
    'https://www.youtube.com/@VITOENCODES',
    'https://www.instagram.com/VITOENCODES/',
    'https://www.facebook.com/VITOENCODES/',
  ],
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': baseUrl+'#website',
  name: 'VITOENCODES',
  alternateName: 'VITO ENCODES',
  url: baseUrl,
  description: 'Cinema, preserved. Explore movie editions, encodes and release specifications from VITOENCODES.',
  publisher: {'@id':baseUrl+'#organization'},
  inLanguage: 'en',
};

export default function Layout({children}: {children: React.ReactNode}) {
  const organizationJson=JSON.stringify(organizationSchema).replace(/</g,'\\u003c');
  const websiteJson=JSON.stringify(websiteSchema).replace(/</g,'\\u003c');

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta
          name="google-adsense-account"
          content="ca-pub-9525707589399873"
        />
      </head>

      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{__html:organizationJson}} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{__html:websiteJson}} />
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
