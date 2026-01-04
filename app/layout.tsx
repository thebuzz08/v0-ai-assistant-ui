import type React from "react"
import { Analytics } from "@vercel/analytics/next"
import { ClerkProvider } from "@clerk/nextjs"
import "./globals.css"
import ClientLayout from "./client-layout"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider signInUrl="/login" signUpUrl="/login" afterSignInUrl="/" afterSignUpUrl="/">
      <html lang="en" suppressHydrationWarning>
        <head>
          <title>Proactive Assistant</title>
          <meta
            name="description"
            content="Your mind. Augmented. A proactive in-ear assistant that helps before you ask."
          />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
          />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content="Assistant" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
          <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
          <link rel="apple-touch-icon" href="/icon-192.png" />
        </head>
        <body className="font-sans antialiased overscroll-none">
          <ClientLayout>{children}</ClientLayout>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  )
}

export const metadata = {
  generator: "v0.app",
}
