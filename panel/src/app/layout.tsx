import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/sonner';
import SessionStatusIndicator from '@/components/SessionStatusIndicator';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'VendaBoost Panel',
  description: 'Painel de controle para automação de publicações no Facebook Marketplace',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-background">
            <header className="border-b">
              <div className="container mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <h1 className="text-2xl font-bold text-primary">
                      VendaBoost Panel
                    </h1>
                  </div>
                  <div className="flex items-center space-x-6">
                    <nav className="flex items-center space-x-4">
                      <a
                        href="/"
                        className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                      >
                        Dashboard
                      </a>
                      <a
                        href="/publish"
                        className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                      >
                        Publicar
                      </a>
                      <a
                        href="/jobs"
                        className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                      >
                        Jobs
                      </a>
                    </nav>
                    <SessionStatusIndicator />
                  </div>
                </div>
              </div>
            </header>
            <main className="container mx-auto px-4 py-8">
              {children}
            </main>
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
