import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Xenon AI",
  description: "Your AI assistant",
  icons: {
    icon: [
      { url: "/xenon-icon.png", sizes: "512x512", type: "image/png" },
      { url: "/xenon-icon.png", sizes: "192x192", type: "image/png" },
      { url: "/xenon-icon.png", sizes: "32x32",   type: "image/png" },
    ],
    apple: { url: "/xenon-icon.png", sizes: "180x180", type: "image/png" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
