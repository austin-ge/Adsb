import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HangarTrak Radar",
  description: "Community-powered ADS-B flight tracking network - Power HangarTrak with your feeder",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ colorScheme: "light dark" }}>
      <head>
        <meta name="theme-color" content="#1e40af" />
      </head>
      <body className={inter.className}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md">Skip to main content</a>
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
