import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/revkit/theme-provider";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RevKit",
  description:
    "Plan, manage, analyze, and export systematic reviews with RevKit.",
  keywords: ["RevKit", "RevMan", "systematic review", "meta-analysis", "Cochrane", "PRISMA", "RoB 2", "ROBINS-I", "QUADAS-3", "QUADAS-2"],
  authors: [{ name: "RevKit Contributors" }],
  icons: {
    icon: "/r-logo.png",
    shortcut: "/r-logo.png",
    apple: "/r-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          {children}
          <SonnerToaster
            richColors
            position="top-right"
            theme="system"
            toastOptions={{
              style: {
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--popover)",
                color: "var(--popover-foreground)",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
