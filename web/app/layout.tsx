import type { Metadata } from "next";
import "../styles/globals.css";
import { Masthead } from "./_components/masthead";
import { Footer } from "./_components/footer";

export const metadata: Metadata = {
  title: "BEQUEST — A Crypto Inheritance Agent",
  description:
    "An autonomous onchain agent that delivers your crypto to your beneficiaries when you stop checking in. Built on the Zerion CLI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper text-ink antialiased">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10">
          <Masthead />
          <main className="mt-8">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
