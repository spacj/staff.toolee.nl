import '@/styles/globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import CookieConsent from '@/components/CookieConsent';
import PWAProvider from '@/components/PWAProvider';

const SITE_URL = 'https://staff2.app';
const SITE_TITLE = 'Staff2 — All-in-One Team Operations Platform';
const SITE_DESC = 'Staff2 runs your whole team in one simple app: shift scheduling, time tracking, labor costs, stock & recipes, checklists and a knowledge base. Free for up to 4 employees — works on any phone, no app store.';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#4c6ef5',
};

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: '%s · Staff2' },
  description: SITE_DESC,
  applicationName: 'Staff2',
  keywords: [
    'team operations platform', 'staff management software', 'shift scheduling',
    'rota software', 'employee scheduling', 'staff scheduling app', 'time tracking',
    'clock in clock out', 'labor cost tracking', 'inventory management', 'stock management',
    'recipe costing', 'checklists app', 'knowledge base', 'small business software',
    'restaurant scheduling', 'cafe management', 'retail staff scheduling', 'workforce management',
  ],
  authors: [{ name: 'Staff2', url: SITE_URL }],
  creator: 'Staff2',
  publisher: 'Staff2',
  manifest: '/manifest.json',
  alternates: { canonical: '/' },
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Staff2',
  },
  formatDetection: { telephone: false },
  category: 'business',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
      { url: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.svg', sizes: '180x180', type: 'image/svg+xml' },
    ],
  },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Staff2',
    title: SITE_TITLE,
    description: SITE_DESC,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESC,
  },
};

// Structured data for rich results (Organization + the app itself).
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Staff2',
      url: SITE_URL,
      logo: `${SITE_URL}/icons/icon.svg`,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'Staff2',
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Staff2',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, iOS, Android',
      description: SITE_DESC,
      url: SITE_URL,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'EUR',
        description: 'Free for up to 4 employees. Paid plans from €2/employee/month.',
      },
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Staff2" />
        <meta name="application-name" content="Staff2" />
        <meta name="msapplication-TileColor" content="#4c6ef5" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body className="h-full">
        <AuthProvider>
          <PWAProvider>
            {children}
            <CookieConsent />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 3000,
                style: {
                  borderRadius: '16px',
                  padding: '14px 18px',
                  fontSize: '14px',
                  fontWeight: 500,
                  boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                  border: '1px solid rgba(0,0,0,0.04)',
                },
                success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
                error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
              }}
            />
          </PWAProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
