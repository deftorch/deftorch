import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Deftorch - AI Orchestration Platform',
  description: 'Create amazing content with AI - slides, images, GIFs, videos, and UI components',
  keywords: ['AI', 'content creation', 'Deftorch', 'slides', 'images', 'video', 'UI design'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
