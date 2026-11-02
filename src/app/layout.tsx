import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Lato } from "next/font/google";
import { AppearanceProvider } from "@/components/providers/appearance-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PREPAINT_SCRIPT } from "@/lib/appearance";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Only Geist, the default, is preloaded. The others load when someone chooses them.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  preload: false,
});

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["400", "700"],
  preload: false,
});

export const metadata: Metadata = {
  title: { default: "Inventory", template: "%s · Inventory" },
  description: "Private inventory platform",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="slate"
      data-scale="normal"
      data-font="geist"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${lato.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREPAINT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <AppearanceProvider>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </AppearanceProvider>
      </body>
    </html>
  );
}
