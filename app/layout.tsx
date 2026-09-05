import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dijkstra Across the Universe',
  icons: { icon: '/favicon.svg' },
  description:
    'Explore a procedural galaxy and watch Dijkstra discover the optimal interstellar route. An interactive 3D graph simulation.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
