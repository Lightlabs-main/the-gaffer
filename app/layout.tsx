/* eslint-disable @next/next/no-page-custom-font */
import type { Metadata } from "next"
import Script from "next/script"
import CopyHandler from "@/components/CopyHandler"
import ThemeToggle from "@/components/ThemeToggle"
import "./globals.css"

export const metadata: Metadata = {
  title: "Gaffer - Paid interactive media",
  description:
    "Creators publish a seed. Audiences pay USDC to unlock and steer. Every creative decision is recorded as provenance on Arc.",
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
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
                    var message = '';
                    try {
                      message = arg && arg.message ? arg.message : String(arg || '');
                    } catch (e) {}
                    return (
                      (arg && arg.name === 'TypeError' && arg.message === 'Failed to fetch') ||
                      arg === 'Failed to fetch' ||
                      message.indexOf('Failed to connect to MetaMask') !== -1
                    );
                  });
                  if (isFetchNoise) return;
                  originalError.apply(console, args);
                };
                window.addEventListener('unhandledrejection', function (event) {
                  var reason = event.reason;
                  var message = '';
                  try {
                    message = reason && reason.message ? reason.message : String(reason || '');
                  } catch (e) {}
                  if (
                    (reason && reason.name === 'TypeError' && reason.message === 'Failed to fetch') ||
                    message.indexOf('Failed to connect to MetaMask') !== -1
                  ) {
                    event.preventDefault();
                  }
                });
              })();
            `,
          }}
        />
        {children}
        <CopyHandler />
        <ThemeToggle />
      </body>
    </html>
  )
}
