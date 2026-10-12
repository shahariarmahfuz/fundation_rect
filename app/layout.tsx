'use client';

import React, { useState, useEffect } from 'react';
import './globals.css';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { SettingsProvider, useSettings } from '@/lib/settings-context';
import { SidebarNav } from '@/components/ui/dashboard-sidebar';
import { PanelLeftClose, PanelLeftOpen, Menu, X, LogOut, Loader2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const { user, loading, logout } = useAuth();
  const { appDisplayName, foundationName, foundationLogo } = useSettings();
  const pathname = usePathname();
  const router = useRouter();

  // If on login page, render children directly without dashboard shell
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Redirect to login if unauthenticated after session check
  useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      const returnUrl = encodeURIComponent(pathname);
      router.push(`/login?return_url=${returnUrl}`);
    }
  }, [loading, user, pathname, router]);

  // Close mobile drawer when path changes
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileDrawerOpen]);

  // Show loading state while verifying server session
  if (loading && !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground font-medium">Verifying session...</span>
        </div>
      </div>
    );
  }

  // If unauthenticated, do not flash private dashboard content
  if (!user) {
    return null;
  }

  const userInitial = user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U';

  return (
    <div className="flex h-screen w-full max-w-full overflow-hidden bg-background">
      {/* Mobile Drawer Backdrop */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300"
          onClick={() => setMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer (Slide-in) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] h-full bg-card shadow-2xl md:hidden transform transition-transform duration-300 ease-in-out flex flex-col ${
          mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Mobile Navigation Drawer"
      >
        <div className="flex items-center justify-between p-3 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {foundationLogo ? (
              <img src={foundationLogo} alt={foundationName} className="w-5 h-5 object-contain rounded shrink-0" />
            ) : null}
            <span className="font-semibold text-xs tracking-tight text-foreground truncate">
              {appDisplayName}
            </span>
          </div>
          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground cursor-pointer"
            aria-label="Close menu drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav
            className="w-full border-none bg-transparent"
            onItemClick={() => setMobileDrawerOpen(false)}
          />
        </div>
      </aside>

      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden md:flex flex-col h-full shrink-0 transition-all duration-300 ease-in-out bg-card/60 border-r border-border/50 ${
          desktopSidebarOpen ? 'w-[260px]' : 'w-0 overflow-hidden border-none'
        }`}
      >
        <SidebarNav className="w-[260px] border-none bg-transparent" />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 w-full max-w-full h-full overflow-hidden">
        {/* Top Header Bar */}
        <header className="border-b border-border/50 bg-card/70 backdrop-blur-sm shrink-0 z-10 w-full max-w-full">
          <div className="h-14 px-3 sm:px-4 flex items-center justify-between gap-2 w-full max-w-full">
            {/* Toggle & Brand */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <button
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setMobileDrawerOpen(prev => !prev);
                  } else {
                    setDesktopSidebarOpen(prev => !prev);
                  }
                }}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground transition-colors shrink-0 cursor-pointer"
                aria-label="Toggle navigation menu"
              >
                <span className="hidden md:inline">
                  {desktopSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
                </span>
                <span className="md:hidden">
                  <Menu className="w-5 h-5" />
                </span>
              </button>
              <div className="flex items-center gap-2 min-w-0 truncate">
                {foundationLogo ? (
                  <img src={foundationLogo} alt={foundationName} className="w-6 h-6 object-contain rounded shrink-0" />
                ) : null}
                <span className="font-semibold text-foreground text-xs sm:text-sm truncate">
                  {appDisplayName}
                </span>
              </div>
            </div>

            {/* Desktop Authenticated User Display */}
            <div className="hidden sm:flex items-center gap-3 shrink-0">
              <div className="flex flex-col items-end text-xs min-w-0">
                <span className="font-medium text-foreground leading-tight truncate max-w-[160px]">
                  {user.full_name}
                </span>
                <span className="text-[11px] text-muted-foreground leading-tight truncate max-w-[160px]">
                  {user.role_name || 'Member'}
                </span>
              </div>

              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-semibold text-xs shadow-xs shrink-0">
                {userInitial}
              </div>

              <button
                onClick={logout}
                title="Log out"
                className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0 cursor-pointer ml-1"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            {/* Mobile Compact User Indicator & Logout */}
            <div className="flex sm:hidden items-center gap-2 shrink-0">
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary truncate max-w-[90px]">
                {user.role_name || 'Member'}
              </span>
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-semibold text-[11px] shadow-xs shrink-0">
                {userInitial}
              </div>
              <button
                onClick={logout}
                title="Log out"
                className="p-1 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0 cursor-pointer"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-black/[0.015] dark:bg-white/[0.015] p-3 sm:p-5 lg:p-8 w-full max-w-full min-w-0">
          <div className="max-w-7xl mx-auto w-full max-w-full min-w-0">
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
    <html lang="en" className="h-full">
      <head>
        <title>Foundation Management System</title>
        <meta name="description" content="Management system for Groups, Members, and Beneficiaries" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
      </head>
      <body className="h-full antialiased overflow-x-hidden">
        <AuthProvider>
          <SettingsProvider>
            <DashboardShell>{children}</DashboardShell>
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
