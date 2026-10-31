import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rouxte — Field Sales Intelligence",
  description: "Door-to-door sales enablement built for fiber teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        {/* GroBigga growth tag (rouxte-web#31): one page_view per load plus the ?src= token, so Postastic posts can prove they worked. Public key, scoped to rouxte.com / www.rouxte.com / rouxte.vercel.app. */}
        <Script
          src="https://gro-bigga.vercel.app/grobigga-sdk.js"
          data-sdk-key="gb_987a73b3ab584590b99f510efb6c05c0"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
