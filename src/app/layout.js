import '@/styles/globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'react-hot-toast';

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
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: 500,
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
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
