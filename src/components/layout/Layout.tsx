import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
  header?: ReactNode;
}

export function Layout({ children, header }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {header}
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
