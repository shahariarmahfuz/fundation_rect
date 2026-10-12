'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth-context';

export interface ContributionSettingData {
  id: number;
  monthly_amount: string | number;
  currency: string;
  effective_from: string;
  is_collection_enabled: boolean;
  updated_by_id?: number | null;
  updated_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FoundationSettings {
  id?: number;
  foundation_name: string;
  foundation_short_name?: string | null;
  foundation_logo?: string | null;
  foundation_logo_public_id?: string | null;
  tagline?: string | null;
  registration_number?: string | null;
  email?: string | null;
  phone?: string | null;
  phone_secondary?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country: string;
  website_url?: string | null;
  about?: string | null;

  currency_code: string;
  currency_symbol: string;
  decimal_precision: number;
  date_format: string;
  payment_methods: string;
  fiscal_year_start_month: number;
  require_transaction_reference: boolean;

  group_prefix: string;
  member_prefix: string;
  beneficiary_prefix: string;
  donation_prefix: string;
  sadaqah_prefix: string;
  qard_hasan_prefix: string;
  contribution_prefix: string;
  default_member_status: string;
  default_group_status: string;

  app_display_name: string;
  default_language: string;
  time_zone: string;
  receipt_footer_text?: string | null;
  report_header_text?: string | null;
  report_footer_text?: string | null;

  updated_by_id?: number | null;
  updated_by_name?: string | null;
  created_at?: string;
  updated_at?: string;

  contribution_setting?: ContributionSettingData | null;
}

const DEFAULT_SETTINGS: FoundationSettings = {
  foundation_name: 'Al-Barakah Welfare Foundation',
  foundation_short_name: 'ABWF',
  foundation_logo: null,
  foundation_logo_public_id: null,
  tagline: 'Empowering Communities, Transforming Lives',
  country: 'Bangladesh',
  currency_code: 'BDT',
  currency_symbol: '৳',
  decimal_precision: 2,
  date_format: 'YYYY-MM-DD',
  payment_methods: 'Cash,Bank Transfer,Card,Mobile Money,Cheque',
  fiscal_year_start_month: 1,
  require_transaction_reference: false,
  group_prefix: 'G-',
  member_prefix: 'M-',
  beneficiary_prefix: 'B-',
  donation_prefix: 'D-',
  sadaqah_prefix: 'S-',
  qard_hasan_prefix: 'QH-',
  contribution_prefix: 'MC-',
  default_member_status: 'Active',
  default_group_status: 'Active',
  app_display_name: 'Foundation Management System',
  default_language: 'en',
  time_zone: 'Asia/Dhaka',
  receipt_footer_text: 'Thank you for your generous contribution. May Allah accept your righteous deeds.',
  report_header_text: 'Official Financial & Operational Audit Report',
  report_footer_text: 'Confidential — For Internal and Trustee Use Only',
};

interface SettingsContextType {
  settings: FoundationSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  formatCurrency: (amount: number | string | null | undefined) => string;
  formatDate: (dateInput: string | Date | null | undefined) => string;
  foundationName: string;
  foundationShortName: string;
  foundationLogo: string | null;
  tagline: string | null;
  appDisplayName: string;
  currencySymbol: string;
  currencyCode: string;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<FoundationSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  let authContext: any = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    authContext = useAuth();
  } catch (e) {
    // optional if unauthenticated or outside auth provider
  }

  const user = authContext?.user;
  const hasSettingsPerm = authContext?.hasPermission ? authContext.hasPermission('settings.view') : false;

  const fetchSettings = useCallback(async () => {
    try {
      if (user && hasSettingsPerm) {
        const res = await fetch('/api/settings', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setSettings(prev => ({ ...prev, ...data }));
          setLoading(false);
          return;
        }
      }

      // Fallback to public settings
      const pubRes = await fetch('/api/settings/public');
      if (pubRes.ok) {
        const pubData = await pubRes.json();
        setSettings(prev => ({ ...prev, ...pubData }));
      }
    } catch (err) {
      console.error('Failed to load foundation settings:', err);
    } finally {
      setLoading(false);
    }
  }, [user, hasSettingsPerm]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const formatCurrency = useCallback((amount: number | string | null | undefined) => {
    if (amount === null || amount === undefined || amount === '') return `${settings.currency_symbol} 0.00`;
    const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
    if (isNaN(num)) return `${settings.currency_symbol} 0.00`;
    const precision = settings.decimal_precision ?? 2;
    const parts = num.toFixed(precision).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${settings.currency_symbol} ${parts.join('.')}`;
  }, [settings.currency_symbol, settings.decimal_precision]);

  const formatDate = useCallback((dateInput: string | Date | null | undefined) => {
    if (!dateInput) return '-';
    try {
      const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      if (isNaN(d.getTime())) return String(dateInput);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      
      const fmt = settings.date_format || 'YYYY-MM-DD';
      if (fmt === 'DD/MM/YYYY') return `${day}/${month}/${year}`;
      if (fmt === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
      if (fmt === 'DD-MM-YYYY') return `${day}-${month}-${year}`;
      return `${year}-${month}-${day}`;
    } catch {
      return String(dateInput);
    }
  }, [settings.date_format]);

  const value: SettingsContextType = {
    settings,
    loading,
    refreshSettings: fetchSettings,
    formatCurrency,
    formatDate,
    foundationName: settings.foundation_name || DEFAULT_SETTINGS.foundation_name,
    foundationShortName: settings.foundation_short_name || DEFAULT_SETTINGS.foundation_short_name || 'ABWF',
    foundationLogo: settings.foundation_logo || null,
    tagline: settings.tagline || DEFAULT_SETTINGS.tagline || null,
    appDisplayName: settings.app_display_name || DEFAULT_SETTINGS.app_display_name,
    currencySymbol: settings.currency_symbol || DEFAULT_SETTINGS.currency_symbol,
    currencyCode: settings.currency_code || DEFAULT_SETTINGS.currency_code,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
