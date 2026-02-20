import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import SearchBar from "@/components/SearchBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Analytics } from "@vercel/analytics/next";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "C++ Proposals Explorer",
    template: "%s | C++ Proposals Explorer",
  },
  description:
    "Terminal-style searchable, AI-powered archive of the isocpp std-proposals mailing list. Search 30,000+ emails, explore threads, and ask questions about C++ standardization.",
  keywords: [
    "C++",
    "ISO C++",
    "proposals",
    "std-proposals",
    "standardization",
    "mailing list",
    "WG21",
  ],
  openGraph: {
    title: "C++ Proposals Explorer",
    description:
      "AI-powered search and exploration of the C++ standardization mailing list archive.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={jetbrainsMono.variable} suppressHydrationWarning>
      <body suppressHydrationWarning className="bg-terminal-bg text-terminal-text font-mono antialiased">
        <div className="scanline-overlay" />
        <div className="flex h-screen overflow-hidden crt-effect">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <header className="flex items-center gap-3 px-4 py-3 border-b border-terminal-border bg-terminal-surface flex-shrink-0">
              <div className="w-8 md:hidden" />
              <div className="flex-1">
                <SearchBar />
              </div>
              <ThemeToggle />
            </header>
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
