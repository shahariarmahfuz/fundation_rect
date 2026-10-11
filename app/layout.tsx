'use client';

import React, { useState } from 'react';
import './globals.css';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { SidebarNav } from '@/components/ui/dashboard-sidebar';
import { PanelLeftClose, PanelLeftOpen, Shield, Bell, CheckCircle2 } from 'lucide-react';

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, activeUsername, switchUser, availableUsers } = useAuth();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={`h-full transition-all duration-300 ease-in-out shrink-0 overflow-hidden bg-card/60 border-r border-border/50 ${
          sidebarOpen ? 'w-[260px] opacity-100' : 'w-0 opacity-0 border-none'
        }`}
      >
        <SidebarNav className="w-[260px] border-none bg-transparent" />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="h-14 border-b border-border/50 bg-card/70 backdrop-blur-sm px-4 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground transition-colors"
              title="Toggle sidebar"
            >
              {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Foundation Management System</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick RBAC Switcher */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground hidden sm:inline">Active Role:</span>
              <select
                value={activeUsername}
                onChange={(e) => switchUser(e.target.value)}
                className="bg-secondary/70 border border-border/60 text-foreground font-medium rounded-md px-2.5 py-1 text-xs focus:ring-1 focus:ring-primary outline-none cursor-pointer"
              >
                {availableUsers.map((u) => (
                  <option key={u.username} value={u.username}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-semibold text-xs shadow-xs">
              {user?.full_name ? user.full_name.charAt(0) : 'U'}
            </div>
          </div>
        </header>

        {/* Dynamic page content */}
        <main className="flex-1 overflow-y-auto bg-black/[0.015] dark:bg-white/[0.015] p-4 md:p-8">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>Foundation Management System</title>
        <meta name="description" content="Management system for Groups, Members, and Beneficiaries" />
      </head>
      <body>
        <AuthProvider>
          <DashboardShell>{children}</DashboardShell>
        </AuthProvider>
      </body>
    </html>
  );
}
