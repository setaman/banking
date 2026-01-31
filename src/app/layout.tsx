import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { DemoProvider } from "@/contexts/demo-context";
import { SyncProvider } from "@/contexts/sync-context";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BanKing - Personal Banking App",
  description:
    "A personal banking app for importing and analyzing financial transactions from German bank CSV exports",
};

import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <DemoProvider>
            <SyncProvider>
              <div className="flex min-h-screen flex-col">
                <Header />
                <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-32 sm:px-6 lg:px-8">
                  {children}
                </main>
                <Footer />
              </div>
              <Toaster />
            </SyncProvider>
          </DemoProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
