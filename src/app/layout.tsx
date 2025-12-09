import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SOW Copilot",
  description: "AI-powered Statement of Work analyzer and reviewer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        {children}
      </body>
    </html>
  );
}
