import '@/styles/globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import CookieConsent from '@/components/CookieConsent';
import PWAProvider from '@/components/PWAProvider';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#4c6ef5',
};

export const metadata = {
  title: 'StaffHub — Staff Management Platform',
  description: 'Manage your team, shifts, costs, and projects all in one place.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'StaffHub',
  },
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
    siteName: 'StaffHub',
    title: 'StaffHub — Staff Management Platform',
    description: 'Manage your team, shifts, costs, and projects all in one place.',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="StaffHub" />
        <meta name="application-name" content="StaffHub" />
        <meta name="msapplication-TileColor" content="#4c6ef5" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
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
