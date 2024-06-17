import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import TopNav from "@/src/components/TopNav";
import { ThemeProvider } from "next-themes";
import { getUser } from "@/app/user.actions";
import { redirect } from "next/navigation";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BanKing",
  description: "You private banking app",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TopNav />
          <div>
            <div className="p-7 pt-24">{children}</div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
