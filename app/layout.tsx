import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Masters Pool 2026",
  description: "Pick your golfers and compete with coworkers in the Masters Pool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
