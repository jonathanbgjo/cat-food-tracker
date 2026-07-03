import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cat Feeder",
  description: "Track when the cats were fed",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
