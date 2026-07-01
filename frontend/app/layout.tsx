import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "DataBrief — Your data knows something you don't.",
  description:
    "Upload any data and get a curiosity-driven narrative story delivered as PDF, Word, or branded PowerPoint.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full" suppressHydrationWarning>
      <body className="grid-bg min-h-full flex flex-col antialiased">
        <TooltipProvider>
          {children}
          <Toaster theme="dark" />
        </TooltipProvider>
      </body>
    </html>
  );
}
