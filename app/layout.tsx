import type { Metadata } from "next"
import Script from "next/script"
import ThemeToggle from "@/components/ThemeToggle"
import "./globals.css"

export const metadata: Metadata = {
  title: "The Gaffer - The Crowd Decides",
  description:
    "Live virtual football managed by the crowd with USDC micropayments. Money is the steering wheel.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <Script
          id="gaffer-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var stored = null;
                  try {
                    stored = localStorage.getItem('gaffer-theme');
                  } catch (e) {}
                  var cookieMatch = null;
                  try {
                    cookieMatch = document.cookie.match(/(?:^|; )gaffer-theme=(dark|light)/);
                  } catch (e) {}
                  var nameTheme = window.name === 'gaffer-theme:dark' || window.name === 'gaffer-theme:light' ? window.name.split(':')[1] : null;
                  var theme = stored || (cookieMatch && cookieMatch[1]) || nameTheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                  document.documentElement.classList.toggle('dark', theme === 'dark');
                  document.documentElement.style.colorScheme = theme;
                } catch (e) {}
              })();
            `,
          }}
        />
        <Script
          id="gaffer-dev-fetch-noise-filter"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                if (location.hostname !== 'localhost') return;
                if (window.__gafferFetchNoiseFilter) return;
                window.__gafferFetchNoiseFilter = true;
                var originalError = console.error.bind(console);
                console.error = function () {
                  var args = Array.prototype.slice.call(arguments);
                  var isFetchNoise = args.some(function (arg) {
                    return (
                      (arg && arg.name === 'TypeError' && arg.message === 'Failed to fetch') ||
                      arg === 'Failed to fetch'
                    );
                  });
                  if (isFetchNoise) return;
                  originalError.apply(console, args);
                };
                window.addEventListener('unhandledrejection', function (event) {
                  var reason = event.reason;
                  if (reason && reason.name === 'TypeError' && reason.message === 'Failed to fetch') {
                    event.preventDefault();
                  }
                });
              })();
            `,
          }}
        />
        {children}
        <ThemeToggle />
      </body>
    </html>
  )
}
