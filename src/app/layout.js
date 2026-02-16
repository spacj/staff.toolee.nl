import '@/styles/globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import CookieConsent from '@/components/CookieConsent';

export const metadata = {
  title: 'StaffHub — Staff Management Platform',
  description: 'Manage your team, shifts, costs, and projects all in one place.',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover',
  themeColor: '#4c6ef5',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="h-full">
        <AuthProvider>
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
        </AuthProvider>
      </body>
    </html>
  );
}
