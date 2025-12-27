import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'Whale Watcher Pro | Real-Time Crypto Whale Detection',
  description: 'Detect and analyze massive cryptocurrency whale trades in real-time. Monitor institutional movements with advanced visualizations and market sentiment analysis.',
  keywords: ['Bitcoin', 'Whale', 'Trading', 'Crypto', 'Real-time', 'Dashboard'],
  openGraph: {
    title: 'Whale Watcher Pro',
    description: 'Real-time cryptocurrency whale detection dashboard',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
