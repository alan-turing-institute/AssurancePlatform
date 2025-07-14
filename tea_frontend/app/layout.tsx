import type { Metadata } from 'next';
import { Inter as FontSans } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { ThemeProvider } from '@/providers/theme-provider';
import { ModalProvider } from '@/providers/modal-provider';
import { Toaster } from '@/components/ui/toaster';
import { authOptions } from '@/lib/authOptions';
import { getServerSession } from 'next-auth';
import SessionProvider from '@/providers/session-provider';

export const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Turing Assurance Platform',
  description: 'Platform for generating assurance cases',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased',
          fontSans.variable
        )}
      >
        <SessionProvider session={session}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <ModalProvider />
            <Toaster />
          </ThemeProvider>
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}
