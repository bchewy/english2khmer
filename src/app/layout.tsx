'use client'

import { ChakraProvider, extendTheme } from '@chakra-ui/react'
import { CacheProvider } from '@chakra-ui/next-js'
import './globals.css'

const theme = extendTheme({
  styles: {
    global: {
      body: {
        bg: 'gray.900',
        color: 'white',
      },
    },
  },
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <title>English to Khmer Live Translation</title>
        <meta name="description" content="Real-time English to Khmer translation using AI" />
      </head>
      <body className="h-full bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 text-white antialiased">
        <div className="min-h-full relative">
          {/* Animated background */}
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
          
          {/* Gradient blob */}
          <div className="absolute inset-0 flex justify-center">
            <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob" />
            <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000" />
            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000" />
          </div>

          {/* Content */}
          <CacheProvider>
            <ChakraProvider theme={theme}>
              <main className="relative isolate min-h-full">
                {children}
              </main>
            </ChakraProvider>
          </CacheProvider>
        </div>
      </body>
    </html>
  )
}
