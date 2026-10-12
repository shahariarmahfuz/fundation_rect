'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Building2, 
  Coins, 
  CreditCard, 
  Hash, 
  Sliders, 
  ShieldAlert, 
  Upload, 
  Trash2, 
  Check, 
  AlertCircle, 
  Loader2, 
  Save, 
  RotateCcw, 
  ExternalLink, 
  KeyRound, 
  Lock,
  Eye,
  EyeOff,
  HelpCircle,
  Info
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useSettings, FoundationSettings } from '@/lib/settings-context';
import { ImageUpload } from '@/components/ui/image-upload';

type TabKey = 'foundation' | 'contributions' | 'financial' | 'ids' | 'organization' | 'security';

export default function SettingsPage() {
  const { user, hasPermission } = useAuth();
  const { settings: globalSettings, refreshSettings } = useSettings();

  const [activeTab, setActiveTab] = useState<TabKey>('foundation');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tab dirty states
  const [isDirty, setIsDirty] = useState(false);

  // Form states initialized with settings
  const [formData, setFormData] = useState<FoundationSettings>(globalSettings);
  const initialDataRef = useRef<FoundationSettings>(globalSettings);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Load complete settings from backend
  const loadFullSettings = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/settings', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setFormData(data);
        initialDataRef.current = data;
        setIsDirty(false);
      } else {
        const err = await res.json().catch(() => ({ detail: 'Failed to fetch settings' }));
        setErrorMessage(err.detail || 'Failed to load configuration.');
      }
    } catch (err) {
      setErrorMessage('Network error while loading settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadFullSettings();
    }
  }, [user]);

  // Track dirty changes
  const handleInputChange = (field: keyof FoundationSettings, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      checkDirty(updated);
      return updated;
    });
    setSuccessMessage(null);
  };

  const handleContribChange = (field: string, value: any) => {
    setFormData(prev => {
      const updatedContrib = {
        ...(prev.contribution_setting || {
          id: 1,
          monthly_amount: '100.00',
          currency: 'BDT',
          effective_from: new Date().toISOString().split('T')[0],
          is_collection_enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
        [field]: value,
      };
      const updated = { ...prev, contribution_setting: updatedContrib };
      checkDirty(updated);
      return updated;
    });
    setSuccessMessage(null);
  };

  const checkDirty = (current: FoundationSettings) => {
    const isDifferent = JSON.stringify(current) !== JSON.stringify(initialDataRef.current);
    setIsDirty(isDifferent);
  };

  const handleReset = () => {
    setFormData(initialDataRef.current);
    setIsDirty(false);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  // Tab switch guard
  const handleTabSwitch = (newTab: TabKey) => {
    if (isDirty) {
      const confirmLeave = window.confirm(
        'You have unsaved changes. Switching tabs without saving will discard your modifications. Continue?'
      );
      if (!confirmLeave) return;
      handleReset();
    }
    setActiveTab(newTab);
    setSuccessMessage(null);
    setErrorMessage(null);
    setPasswordSuccess(null);
    setPasswordError(null);
  };

  // Save current tab changes
  const handleSaveTab = async (tab: TabKey) => {
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    let endpoint = '';
    let payload: any = {};

    if (tab === 'foundation') {
      endpoint = '/api/settings/foundation';
      payload = {
        foundation_name: formData.foundation_name,
        foundation_short_name: formData.foundation_short_name,
        foundation_logo: formData.foundation_logo,
        foundation_logo_public_id: formData.foundation_logo_public_id,
        tagline: formData.tagline,
        registration_number: formData.registration_number,
        email: formData.email,
        phone: formData.phone,
        phone_secondary: formData.phone_secondary,
        address: formData.address,
        city: formData.city,
        postal_code: formData.postal_code,
        country: formData.country,
        website_url: formData.website_url,
        about: formData.about,
      };
    } else if (tab === 'contributions') {
      endpoint = '/api/settings/contribution';
      const c = formData.contribution_setting;
      payload = {
        monthly_amount: parseFloat(String(c?.monthly_amount || '100')),
        currency: c?.currency || formData.currency_code || 'BDT',
        effective_from: c?.effective_from || new Date().toISOString().split('T')[0],
        is_collection_enabled: c?.is_collection_enabled ?? true,
      };
    } else if (tab === 'financial') {
      endpoint = '/api/settings/financial';
      payload = {
        currency_code: formData.currency_code,
        currency_symbol: formData.currency_symbol,
        decimal_precision: Number(formData.decimal_precision),
        date_format: formData.date_format,
        payment_methods: formData.payment_methods,
        fiscal_year_start_month: Number(formData.fiscal_year_start_month),
        require_transaction_reference: Boolean(formData.require_transaction_reference),
      };
    } else if (tab === 'ids') {
      endpoint = '/api/settings/ids';
      payload = {
        group_prefix: formData.group_prefix,
        member_prefix: formData.member_prefix,
        beneficiary_prefix: formData.beneficiary_prefix,
        donation_prefix: formData.donation_prefix,
        sadaqah_prefix: formData.sadaqah_prefix,
        qard_hasan_prefix: formData.qard_hasan_prefix,
        contribution_prefix: formData.contribution_prefix,
        default_member_status: formData.default_member_status,
        default_group_status: formData.default_group_status,
      };
    } else if (tab === 'organization') {
      endpoint = '/api/settings/organization';
      payload = {
        app_display_name: formData.app_display_name,
        default_language: formData.default_language,
        time_zone: formData.time_zone,
        receipt_footer_text: formData.receipt_footer_text,
        report_header_text: formData.report_header_text,
        report_footer_text: formData.report_footer_text,
      };
    }

    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setFormData(data);
        initialDataRef.current = data;
        setIsDirty(false);
        await refreshSettings();
        setSuccessMessage('Settings saved and synchronized successfully.');
      } else {
        const err = await res.json().catch(() => ({ detail: 'Failed to update settings.' }));
        setErrorMessage(err.detail || 'An error occurred while saving.');
      }
    } catch {
      setErrorMessage('Network error while saving settings.');
    } finally {
      setSaving(false);
    }
  };

  // Password change submission
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Current password is required.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch('/api/settings/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      if (res.ok) {
        setPasswordSuccess('Password changed successfully. Your new credentials are active.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const err = await res.json().catch(() => ({ detail: 'Failed to change password.' }));
        setPasswordError(err.detail || 'Failed to update password.');
      }
    } catch {
      setPasswordError('Network error while updating password.');
    } finally {
      setChangingPassword(false);
    }
  };

  if (!hasPermission('settings.view')) {
    return (
      <div className="p-6 rounded-xl bg-card border border-border/50 text-center max-w-lg mx-auto mt-12 animate-in fade-in">
        <ShieldAlert className="w-12 h-12 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-bold text-foreground">Access Restricted</h2>
        <p className="text-sm text-muted-foreground mt-1">
          You do not have the required permissions (`settings.view`) to access Foundation Settings.
        </p>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; icon: React.ElementType; perm: string }[] = [
    { key: 'foundation', label: 'Foundation Profile', icon: Building2, perm: 'settings.foundation.update' },
    { key: 'contributions', label: 'Contribution Policy', icon: Coins, perm: 'settings.contributions.update' },
    { key: 'financial', label: 'Financial & Rules', icon: CreditCard, perm: 'settings.financial.update' },
    { key: 'ids', label: 'Entity & ID Prefixes', icon: Hash, perm: 'settings.ids.update' },
    { key: 'organization', label: 'Organization & Display', icon: Sliders, perm: 'settings.organization.update' },
    { key: 'security', label: 'Security & Access', icon: KeyRound, perm: 'settings.security.view' },
  ];

  const currentTabConfig = tabs.find(t => t.key === activeTab);
  const canUpdateActiveTab = currentTabConfig ? hasPermission(currentTabConfig.perm) : false;

  return (
    <div className="space-y-6 w-full max-w-full min-w-0 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/50 w-full min-w-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Foundation Settings
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage organization branding, financial policies, entity prefixes, and system parameters.
          </p>
        </div>

        {/* Unsaved changes indicator and action buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {isDirty && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium border border-amber-500/20 animate-pulse">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Unsaved Changes</span>
            </div>
          )}

          {activeTab !== 'security' && (
            <>
              {isDirty && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border/70 hover:bg-black/5 dark:hover:bg-white/5 text-foreground transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSaveTab(activeTab)}
                disabled={saving || !isDirty || !canUpdateActiveTab}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all shadow-xs cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Global Alerts */}
      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in">
          <Check className="w-4 h-4 shrink-0" />
          <span className="flex-1 font-medium">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1 font-medium">{errorMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center bg-card rounded-xl border border-border/50">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-xs text-muted-foreground">Loading configuration data...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 w-full min-w-0">
          {/* Navigation Tabs: Horizontal scroll on mobile, Vertical stack on desktop */}
          <div className="lg:col-span-1 min-w-0">
            <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 gap-1.5 p-1 rounded-xl bg-card border border-border/50 max-w-full">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => handleTabSwitch(tab.key)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap text-left shrink-0 lg:shrink cursor-pointer ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Audit Card */}
            <div className="mt-4 p-3.5 rounded-xl bg-card/60 border border-border/40 text-[11px] text-muted-foreground hidden lg:block">
              <span className="font-semibold text-foreground block mb-1">Configuration Audit</span>
              <p className="truncate">Updated by: {formData.updated_by_name || 'System Initializer'}</p>
              <p className="truncate">
                Last modified: {formData.updated_at ? new Date(formData.updated_at).toLocaleString() : 'N/A'}
              </p>
            </div>
          </div>

          {/* Tab Content Panes */}
          <div className="lg:col-span-3 min-w-0">
            <div className="bg-card rounded-xl border border-border/50 p-4 sm:p-6 shadow-xs min-w-0">
              {!canUpdateActiveTab && activeTab !== 'security' && (
                <div className="mb-6 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs flex items-center gap-2">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>You have read-only access to this settings section. Contact a system administrator to request modification privileges.</span>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 1: Foundation Profile Settings */}
              {/* ========================================================= */}
              {activeTab === 'foundation' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Foundation Profile</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Legal identification, primary contact channels, and branding logo.
                    </p>
                  </div>

                  {/* Reusable Cloudinary Image Upload */}
                  <ImageUpload
                    label="Foundation Branding Logo"
                    description="Supported formats: JPEG, PNG, WebP, SVG. Recommended square or landscape format. Max 5MB."
                    value={formData.foundation_logo}
                    publicId={formData.foundation_logo_public_id}
                    onChange={(url, publicId) => {
                      setFormData(prev => ({
                        ...prev,
                        foundation_logo: url,
                        foundation_logo_public_id: publicId || null,
                      }));
                      setIsDirty(true);
                    }}
                    onRemove={() => {
                      setFormData(prev => ({
                        ...prev,
                        foundation_logo: null,
                        foundation_logo_public_id: null,
                      }));
                      setIsDirty(true);
                    }}
                    purpose="foundation_logo"
                    maxSizeMB={5}
                    disabled={!canUpdateActiveTab}
                    aspectRatio="square"
                  />

                  {/* Form fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Foundation Name <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.foundation_name || ''}
                        onChange={(e) => handleInputChange('foundation_name', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        placeholder="e.g. Al-Barakah Welfare Foundation"
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Short Name / Acronym
                      </label>
                      <input
                        type="text"
                        value={formData.foundation_short_name || ''}
                        onChange={(e) => handleInputChange('foundation_short_name', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        placeholder="e.g. ABWF"
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Registration Number
                      </label>
                      <input
                        type="text"
                        value={formData.registration_number || ''}
                        onChange={(e) => handleInputChange('registration_number', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        placeholder="e.g. REG-2024-8971B"
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Tagline / Slogan
                      </label>
                      <input
                        type="text"
                        value={formData.tagline || ''}
                        onChange={(e) => handleInputChange('tagline', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        placeholder="e.g. Empowering Communities, Transforming Lives"
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Official Email
                      </label>
                      <input
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        placeholder="info@foundation.org"
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Primary Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.phone || ''}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        placeholder="+880 1711-000000"
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Secondary Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.phone_secondary || ''}
                        onChange={(e) => handleInputChange('phone_secondary', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        placeholder="+880 1811-000000"
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Website URL
                      </label>
                      <input
                        type="url"
                        value={formData.website_url || ''}
                        onChange={(e) => handleInputChange('website_url', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        placeholder="https://foundation.org"
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Physical Address
                      </label>
                      <input
                        type="text"
                        value={formData.address || ''}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        placeholder="House 42, Road 11, Dhanmondi"
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        City / District
                      </label>
                      <input
                        type="text"
                        value={formData.city || ''}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        placeholder="Dhaka"
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Postal Code
                      </label>
                      <input
                        type="text"
                        value={formData.postal_code || ''}
                        onChange={(e) => handleInputChange('postal_code', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        placeholder="1209"
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Country
                      </label>
                      <input
                        type="text"
                        value={formData.country || 'Bangladesh'}
                        onChange={(e) => handleInputChange('country', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        About Foundation
                      </label>
                      <textarea
                        rows={3}
                        value={formData.about || ''}
                        onChange={(e) => handleInputChange('about', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        placeholder="Brief overview of foundation missions, goals, and activities..."
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 resize-y"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 2: Global Contribution Settings */}
              {/* ========================================================= */}
              {activeTab === 'contributions' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Global Contribution Policy</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Configure monthly membership contribution dues, active collection status, and effective dates.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-xs text-foreground/80 space-y-1">
                    <span className="font-semibold text-primary block">Historical Integrity Assurance</span>
                    <p>
                      Adjusting the monthly contribution amount or policy will govern upcoming collections and due list evaluations. All past paid receipts, cancellations, and ledger transactions remain strictly preserved.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Monthly Contribution Amount <span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground font-semibold text-xs">
                          {formData.currency_symbol || '৳'}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={formData.contribution_setting?.monthly_amount || ''}
                          onChange={(e) => handleContribChange('monthly_amount', e.target.value)}
                          disabled={!canUpdateActiveTab}
                          className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Contribution Currency
                      </label>
                      <input
                        type="text"
                        value={formData.contribution_setting?.currency || formData.currency_code || 'BDT'}
                        onChange={(e) => handleContribChange('currency', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Effective From Date
                      </label>
                      <input
                        type="date"
                        value={formData.contribution_setting?.effective_from || ''}
                        onChange={(e) => handleContribChange('effective_from', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-black/[0.01] dark:bg-white/[0.01] sm:col-span-2">
                      <div>
                        <span className="text-xs font-semibold text-foreground block">Enable Contribution Collection</span>
                        <span className="text-[11px] text-muted-foreground">
                          When enabled, field officers and members can record monthly dues and view due lists.
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer ml-4">
                        <input
                          type="checkbox"
                          checked={formData.contribution_setting?.is_collection_enabled ?? true}
                          onChange={(e) => handleContribChange('is_collection_enabled', e.target.checked)}
                          disabled={!canUpdateActiveTab}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 3: Financial Settings */}
              {/* ========================================================= */}
              {activeTab === 'financial' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Financial & Accounting Rules</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Currency symbols, precision, payment options, and transaction reference policies.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Currency Code (ISO) <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.currency_code || 'BDT'}
                        onChange={(e) => handleInputChange('currency_code', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        placeholder="BDT"
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Currency Symbol <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.currency_symbol || '৳'}
                        onChange={(e) => handleInputChange('currency_symbol', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        placeholder="৳"
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Decimal Precision
                      </label>
                      <select
                        value={formData.decimal_precision}
                        onChange={(e) => handleInputChange('decimal_precision', Number(e.target.value))}
                        disabled={!canUpdateActiveTab}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      >
                        <option value={0}>0 (e.g. ৳ 500)</option>
                        <option value={2}>2 (e.g. ৳ 500.00)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Date Display Format
                      </label>
                      <select
                        value={formData.date_format}
                        onChange={(e) => handleInputChange('date_format', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      >
                        <option value="YYYY-MM-DD">YYYY-MM-DD (2026-10-12)</option>
                        <option value="DD/MM/YYYY">DD/MM/YYYY (12/10/2026)</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY (10/12/2026)</option>
                        <option value="DD-MM-YYYY">DD-MM-YYYY (12-10-2026)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Fiscal Year Start Month
                      </label>
                      <select
                        value={formData.fiscal_year_start_month}
                        onChange={(e) => handleInputChange('fiscal_year_start_month', Number(e.target.value))}
                        disabled={!canUpdateActiveTab}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      >
                        <option value={1}>January</option>
                        <option value={4}>April</option>
                        <option value={7}>July</option>
                        <option value={10}>October</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Accepted Payment Methods (Comma-separated)
                      </label>
                      <input
                        type="text"
                        value={formData.payment_methods || ''}
                        onChange={(e) => handleInputChange('payment_methods', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        placeholder="Cash,Bank Transfer,Card,Mobile Money,Cheque"
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                      <span className="text-[11px] text-muted-foreground mt-1 block">
                        These payment options populate form selectors across Donations, Sadaqah, Qard Hasan repayments, and Contributions.
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-black/[0.01] dark:bg-white/[0.01] sm:col-span-2">
                      <div>
                        <span className="text-xs font-semibold text-foreground block">Mandatory Transaction Reference</span>
                        <span className="text-[11px] text-muted-foreground">
                          When active, financial collection and repayment forms require a bank or gateway reference ID.
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer ml-4">
                        <input
                          type="checkbox"
                          checked={formData.require_transaction_reference ?? false}
                          onChange={(e) => handleInputChange('require_transaction_reference', e.target.checked)}
                          disabled={!canUpdateActiveTab}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 4: Group, Member & ID Generation Prefixes */}
              {/* ========================================================= */}
              {activeTab === 'ids' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Entity ID Prefixes & Defaults</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Custom prefixes for sequential identifiers generated across modules.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-foreground/80 space-y-1">
                    <span className="font-semibold text-amber-600 dark:text-amber-400 block">Prefix Modification Notice</span>
                    <p>
                      Updating prefixes affects newly registered entities and receipts. Historical records retain their original assigned codes to ensure auditability and avoid breaking existing ledger references.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Group Prefix
                      </label>
                      <input
                        type="text"
                        value={formData.group_prefix || 'G-'}
                        onChange={(e) => handleInputChange('group_prefix', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                      <span className="text-[10px] text-muted-foreground mt-0.5 block font-mono">e.g. {formData.group_prefix}0001</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Member Prefix
                      </label>
                      <input
                        type="text"
                        value={formData.member_prefix || 'M-'}
                        onChange={(e) => handleInputChange('member_prefix', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                      <span className="text-[10px] text-muted-foreground mt-0.5 block font-mono">e.g. {formData.member_prefix}0001</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Beneficiary Prefix
                      </label>
                      <input
                        type="text"
                        value={formData.beneficiary_prefix || 'B-'}
                        onChange={(e) => handleInputChange('beneficiary_prefix', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                      <span className="text-[10px] text-muted-foreground mt-0.5 block font-mono">e.g. {formData.beneficiary_prefix}0001</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Donation Receipt Prefix
                      </label>
                      <input
                        type="text"
                        value={formData.donation_prefix || 'D-'}
                        onChange={(e) => handleInputChange('donation_prefix', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                      <span className="text-[10px] text-muted-foreground mt-0.5 block font-mono">e.g. {formData.donation_prefix}0001</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Sadaqah Distribution Prefix
                      </label>
                      <input
                        type="text"
                        value={formData.sadaqah_prefix || 'S-'}
                        onChange={(e) => handleInputChange('sadaqah_prefix', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                      <span className="text-[10px] text-muted-foreground mt-0.5 block font-mono">e.g. {formData.sadaqah_prefix}0001</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Qard Hasan Loan Prefix
                      </label>
                      <input
                        type="text"
                        value={formData.qard_hasan_prefix || 'QH-'}
                        onChange={(e) => handleInputChange('qard_hasan_prefix', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                      <span className="text-[10px] text-muted-foreground mt-0.5 block font-mono">e.g. {formData.qard_hasan_prefix}0001</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Contribution Receipt Prefix
                      </label>
                      <input
                        type="text"
                        value={formData.contribution_prefix || 'MC-'}
                        onChange={(e) => handleInputChange('contribution_prefix', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                      <span className="text-[10px] text-muted-foreground mt-0.5 block font-mono">e.g. {formData.contribution_prefix}0001</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Default Group Status
                      </label>
                      <select
                        value={formData.default_group_status}
                        onChange={(e) => handleInputChange('default_group_status', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Default Member Status
                      </label>
                      <select
                        value={formData.default_member_status}
                        onChange={(e) => handleInputChange('default_member_status', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 5: Organization & System Settings */}
              {/* ========================================================= */}
              {activeTab === 'organization' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Organization & System Preferences</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      App display title, locale, time zone, and receipt/report disclaimers.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Application Display Name <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.app_display_name || ''}
                        onChange={(e) => handleInputChange('app_display_name', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        placeholder="Foundation Management System"
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Default Language
                      </label>
                      <select
                        value={formData.default_language}
                        onChange={(e) => handleInputChange('default_language', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      >
                        <option value="en">English (en)</option>
                        <option value="bn">Bengali (bn)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Time Zone
                      </label>
                      <select
                        value={formData.time_zone}
                        onChange={(e) => handleInputChange('time_zone', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      >
                        <option value="Asia/Dhaka">Asia/Dhaka (GMT+6)</option>
                        <option value="UTC">UTC</option>
                        <option value="Asia/Riyadh">Asia/Riyadh (GMT+3)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Receipt Footer Text
                      </label>
                      <textarea
                        rows={2}
                        value={formData.receipt_footer_text || ''}
                        onChange={(e) => handleInputChange('receipt_footer_text', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        placeholder="Thank you for your generous contribution..."
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 resize-y"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Report Header Text
                      </label>
                      <input
                        type="text"
                        value={formData.report_header_text || ''}
                        onChange={(e) => handleInputChange('report_header_text', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        placeholder="Official Financial & Operational Audit Report"
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Report Footer Text
                      </label>
                      <input
                        type="text"
                        value={formData.report_footer_text || ''}
                        onChange={(e) => handleInputChange('report_footer_text', e.target.value)}
                        disabled={!canUpdateActiveTab}
                        placeholder="Confidential — For Internal and Trustee Use Only"
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 6: User, Role & Security Settings */}
              {/* ========================================================= */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">User & Security Credentials</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Change account password, inspect session tokens, and access RBAC management.
                    </p>
                  </div>

                  {/* Password Change Form */}
                  <div className="p-4 sm:p-5 rounded-xl bg-black/[0.015] dark:bg-white/[0.015] border border-border/50">
                    <div className="flex items-center gap-2 mb-4">
                      <Lock className="w-4 h-4 text-primary" />
                      <h3 className="text-xs sm:text-sm font-semibold text-foreground">Change Account Password</h3>
                    </div>

                    {passwordSuccess && (
                      <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                        <Check className="w-4 h-4 shrink-0" />
                        <span>{passwordSuccess}</span>
                      </div>
                    )}

                    {passwordError && (
                      <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{passwordError}</span>
                      </div>
                    )}

                    <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1">
                          Current Password <span className="text-destructive">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showCurrentPassword ? 'text' : 'password'}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            required
                            placeholder="Enter current password"
                            className="w-full px-3 py-2 pr-9 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1">
                          New Password <span className="text-destructive">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            minLength={6}
                            placeholder="Minimum 6 characters"
                            className="w-full px-3 py-2 pr-9 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1">
                          Confirm New Password <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          placeholder="Re-enter new password"
                          className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={changingPassword || !currentPassword || !newPassword}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs sm:text-sm hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                      >
                        {changingPassword ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Updating Password...</span>
                          </>
                        ) : (
                          <span>Update Password</span>
                        )}
                      </button>
                    </form>
                  </div>

                  {/* RBAC Direct Navigation Link */}
                  {hasPermission('roles.manage') && (
                    <div className="p-4 sm:p-5 rounded-xl bg-card border border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="font-semibold text-xs sm:text-sm text-foreground block">
                          Role-Based Access Control (RBAC)
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Manage foundation roles, assign granular permissions, and govern user accounts.
                        </p>
                      </div>
                      <Link
                        href="/roles"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 text-xs font-semibold transition-colors shrink-0"
                      >
                        <span>Manage Roles & Permissions</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}

                  {/* Security Architecture Summary */}
                  <div className="p-4 rounded-xl bg-black/[0.015] dark:bg-white/[0.015] border border-border/40 space-y-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground block">Session & Architecture Details</span>
                    <ul className="list-disc list-inside space-y-1 text-[11px]">
                      <li>Signed JWT tokens stored in secure, HttpOnly browser session cookies.</li>
                      <li>Argon2id password hashing with memory and time-hardened parameters.</li>
                      <li>Atomic transaction isolation across PostgreSQL fund ledgers.</li>
                      <li>Granular RBAC authorization validated on every API endpoint.</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
