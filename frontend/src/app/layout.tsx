import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ievents+ | Ferias virtuales inmersivas",
  description: "Crea ferias virtuales con pabellones, stands, auditorios, accesos privados, leads y analitica.",
};

import { PresenceProvider } from "@/context/PresenceProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground" suppressHydrationWarning>
        <PresenceProvider>
          <Navbar />
          <main className="flex-1 pt-16">
            {children}
          </main>
        </PresenceProvider>
      </body>
    </html>
  );
}
