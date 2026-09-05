import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'รับอาหาร (Rab-R-HAN) - สั่งอาหารออนไลน์และรับที่ร้าน',
  description: 'ระบบสั่งอาหารออนไลน์ รับที่ร้าน พร้อมเพย์ และคิวออเดอร์',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Rab-R-HAN',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className="min-h-screen antialiased bg-[#fcf9f6] text-stone-900">
        {children}
      </body>
    </html>
  );
}
