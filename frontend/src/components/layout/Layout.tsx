import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-scada-bg">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 relative overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
