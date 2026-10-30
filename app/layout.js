import "./globals.css";
import { AuthProvider } from "../contexts/AuthContext";
import { ThemeProvider, themeInitScript } from "../contexts/ThemeContext";
import { ToastProvider } from "../contexts/ToastContext";
import ServiceWorkerRegister from "../components/layout/ServiceWorkerRegister";
import { Tajawal } from "next/font/google";

const tajawal = Tajawal({
  weight: ['300', '400', '500', '700', '800'],
  subsets: ['arabic', 'latin'],
  variable: '--font-tajawal',
});

export const metadata = {
  title: "نظام نقاط البيع - مادو للتدخين",
  description: "نظام إدارة نقاط البيع للتدخين",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "مادو للتدخين",
  },
  icons: {
    icon: [
      { url: "/icon-192x192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icon-512x512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-icon.svg", sizes: "180x180", type: "image/svg+xml" },
    ],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 2,
  // الكيبورد على أندرويد بيصغّر مساحة الصفحة، فأزرار النوافذ بتفضل فوقه
  interactiveWidget: "resizes-content",
  themeColor: "#000000",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="m-root">
        <ServiceWorkerRegister />
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
