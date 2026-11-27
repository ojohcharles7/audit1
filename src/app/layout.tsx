import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Crunchies Audit & Control",
    template: "%s · Crunchies Audit",
  },
  description:
    "Enterprise internal audit, risk, internal control and corrective action management for Crunchies Fried Chicken.",
  manifest: "/manifest.webmanifest",
  applicationName: "Crunchies Audit",
  appleWebApp: {
    capable: true,
    title: "Crunchies Audit",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1b2b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
