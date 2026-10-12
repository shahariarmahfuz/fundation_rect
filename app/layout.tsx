'use client';

import React, { useState, useEffect } from 'react';
import './globals.css';
import Link from 'next/link';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { SettingsProvider, useSettings } from '@/lib/settings-context';
import { SidebarNav } from '@/components/ui/dashboard-sidebar';
import { PanelLeftClose, PanelLeftOpen, Menu, X, LogOut, Loader2, ChevronDown, ShieldCheck, Settings } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const { user, loading, logout, hasPermission } = useAuth();
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

  // Close mobile drawer and profile dropdown when path changes
  useEffect(() => {
    setMobileDrawerOpen(false);
    setProfileDropdownOpen(false);
  }, [pathname]);

  // Close drawer and profile dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileDrawerOpen(false);
        setProfileDropdownOpen(false);
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
        className={`fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] h-full bg-card shadow-2xl md:hidden transform transition-all duration-300 ease-in-out flex flex-col ${
          mobileDrawerOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none invisible'
        }`}
        aria-label="Mobile Navigation Drawer"
        aria-hidden={!mobileDrawerOpen}
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

            {/* Header User Profile Menu */}
            <div className="relative shrink-0">
              <button
                onClick={() => setProfileDropdownOpen(prev => !prev)}
                className="flex items-center gap-2 sm:gap-2.5 p-1 sm:px-2.5 sm:py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer select-none border border-transparent hover:border-border/40 focus:outline-hidden"
                aria-label="User profile menu"
                aria-expanded={profileDropdownOpen}
                title={user.full_name}
              >
                {/* Desktop: name & role */}
                <div className="hidden sm:flex flex-col items-end text-xs min-w-0">
                  <span className="font-medium text-foreground leading-tight truncate max-w-[150px]">
                    {user.full_name}
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-tight truncate max-w-[150px]">
                    {user.role_name || 'Member'}
                  </span>
                </div>

                {/* Mobile: compact role badge */}
                <span className="sm:hidden text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary truncate max-w-[80px]">
                  {user.role_name || 'Member'}
                </span>

                {/* Avatar / Initial circle */}
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-semibold text-xs shadow-xs shrink-0">
                  {userInitial}
                </div>

                <ChevronDown
                  className={`w-3.5 h-3.5 text-muted-foreground/60 transition-transform duration-200 ${
                    profileDropdownOpen ? 'rotate-180' : ''
                  }`}
                  strokeWidth={1.5}
                />
              </button>

              {/* Profile Dropdown Menu */}
              {profileDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileDropdownOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 top-full mt-1.5 w-60 sm:w-64 max-w-[calc(100vw-1.5rem)] bg-card border border-border/60 rounded-xl shadow-xl z-50 py-2 px-1 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-2 flex flex-col">
                      <span className="text-[13px] font-semibold text-foreground truncate">{user.full_name}</span>
                      {user.email && (
                        <span className="text-[11px] text-muted-foreground truncate">{user.email}</span>
                      )}
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium truncate">
                          {user.role_name || 'Member'}
                        </span>
                        {user.username && (
                          <span className="text-[10px] text-muted-foreground truncate font-mono">
                            @{user.username}
                          </span>
                        )}
                      </div>
                    </div>

                    {hasPermission('roles.manage') && (
                      <>
                        <div className="h-px bg-border/50 my-1 mx-1" />
                        <Link
                          href="/roles"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="px-3 py-2 text-[12px] text-foreground/85 hover:bg-black/5 dark:hover:bg-white/5 rounded-md cursor-pointer transition-colors flex items-center gap-2.5"
                        >
                          <ShieldCheck className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                          <span>Role Permissions</span>
                        </Link>
                      </>
                    )}

                    {hasPermission('settings.view') && (
                      <>
                        <div className="h-px bg-border/50 my-1 mx-1" />
                        <Link
                          href="/settings"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="px-3 py-2 text-[12px] text-foreground/85 hover:bg-black/5 dark:hover:bg-white/5 rounded-md cursor-pointer transition-colors flex items-center gap-2.5"
                        >
                          <Settings className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                          <span>Settings</span>
                        </Link>
                      </>
                    )}

                    <div className="h-px bg-border/50 my-1 mx-1" />
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-3 py-2 text-[12px] text-destructive hover:bg-destructive/10 rounded-md cursor-pointer transition-colors flex items-center gap-2.5"
                    >
                      <LogOut className="w-4 h-4 text-destructive" strokeWidth={1.5} />
                      <span>Log out</span>
                    </button>
                  </div>
                </>
              )}
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
