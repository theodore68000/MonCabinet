import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Toaster } from "react-hot-toast"; // Notifications WhatsApp

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MonCabinet",
  description: "Application médicale",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="bg-gray-50 text-gray-900">

        {/* 🔔 TOASTER — Notifications style WhatsApp */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#0f172a",        // slate-900
              color: "white",
              border: "1px solid #1e293b",  // slate-800
              padding: "10px 14px",
              borderRadius: "12px",
            },
          }}
        />

        {/* 🔗 Barre de navigation (ta version inchangée) */}
        <nav className="bg-white shadow-md mb-6 p-4 flex gap-4 justify-center">
          <a
            href="/"
            className="text-blue-600 hover:underline font-medium"
          >
            Planning
          </a>
          <a
            href="/admin/medecin/ajout"
            className="text-blue-600 hover:underline font-medium"
          >
            Médecins
          </a>
          <a
            href="/admin/patient/ajout"
            className="text-blue-600 hover:underline font-medium"
          >
            Patients
          </a>
        </nav>

        {/* 🧩 Contenu */}
        {children}

      </body>
    </html>
  );
}
