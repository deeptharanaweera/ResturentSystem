'use client';

import React, { useState, useEffect } from 'react';
import {
  getSystemSettings,
  updateSystemSettings,
  getSidebarMenuItems,
  getRolePermissions,
  updateRolePermissions,
} from '@/app/actions/settings';
import { useSystemSettings } from '@/context/SystemSettingsContext';
import { SystemSettings, SidebarMenuItem, RoleMenuPermission, UserRoleType } from '@/types/database';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import {
  Building2,
  Shield,
  Save,
  RefreshCw,
  Loader2,
  Image as ImageIcon,
  Phone,
  Mail,
  MapPin,
  UtensilsCrossed,
  CheckCircle2,
  Check,
  XCircle,
  Sliders,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';

const ALL_ROLES: { key: UserRoleType; label: string; badgeVariant: 'completed' | 'default' | 'preparing' | 'served' }[] = [
  { key: 'super_admin', label: 'Super Admin', badgeVariant: 'completed' },
  { key: 'admin', label: 'Admin', badgeVariant: 'completed' },
  { key: 'pos', label: 'POS Cashier', badgeVariant: 'default' },
  { key: 'kitchen', label: 'Kitchen', badgeVariant: 'preparing' },
  { key: 'waiter', label: 'Waiter', badgeVariant: 'served' },
];

export default function SystemSettingsPage() {
  const { refreshSettings } = useSystemSettings();
  const [activeTab, setActiveTab] = useState<'general' | 'privileges'>('general');
  const [loading, setLoading] = useState(true);

  // System Settings state
  const [settingsForm, setSettingsForm] = useState<Partial<SystemSettings>>({
    restaurant_name: '',
    tagline: '',
    address: '',
    contact_phone: '',
    contact_email: '',
    logo_url: '',
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Privileges state
  const [menuItems, setMenuItems] = useState<SidebarMenuItem[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({}); // role -> menu_item_ids
  const [activeRole, setActiveRole] = useState<UserRoleType>('admin');
  const [savingPermissions, setSavingPermissions] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch system settings
      const settingsRes = await getSystemSettings();
      if (settingsRes.settings) {
        setSettingsForm({
          restaurant_name: settingsRes.settings.restaurant_name || '',
          tagline: settingsRes.settings.tagline || '',
          address: settingsRes.settings.address || '',
          contact_phone: settingsRes.settings.contact_phone || '',
          contact_email: settingsRes.settings.contact_email || '',
          logo_url: settingsRes.settings.logo_url || '',
        });
      }

      // Fetch sidebar items
      const itemsRes = await getSidebarMenuItems();
      const items = itemsRes.items || [];
      setMenuItems(items);

      // Fetch role permissions
      const permRes = await getRolePermissions();
      const perms = permRes.permissions || [];

      // Group permissions by role
      const permMap: Record<string, string[]> = {
        super_admin: [],
        admin: [],
        pos: [],
        kitchen: [],
        waiter: [],
      };

      perms.forEach((p) => {
        if (!permMap[p.role]) permMap[p.role] = [];
        permMap[p.role].push(p.menu_item_id);
      });

      setRolePermissions(permMap);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to load settings data');
    }
    setLoading(false);
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settingsForm.restaurant_name?.trim()) {
      toast.error('Restaurant name is required');
      return;
    }

    setSavingSettings(true);
    const res = await updateSystemSettings(settingsForm);
    setSavingSettings(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success('System settings saved successfully!');
      await refreshSettings();
    }
  }

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo image size must be under 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSettingsForm((prev) => ({ ...prev, logo_url: reader.result as string }));
    };
    reader.readAsDataURL(file);
  }

  function togglePermission(role: string, menuItemId: string) {
    setRolePermissions((prev) => {
      const current = prev[role] || [];
      const exists = current.includes(menuItemId);
      const updated = exists
        ? current.filter((id) => id !== menuItemId)
        : [...current, menuItemId];
      return { ...prev, [role]: updated };
    });
  }

  async function handleSavePermissions(role: string) {
    setSavingPermissions(true);
    const ids = rolePermissions[role] || [];
    const res = await updateRolePermissions(role, ids);
    setSavingPermissions(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(`Role permissions updated for ${role.replace('_', ' ').toUpperCase()}`);
    }
  }

  async function handleSaveAllPermissions() {
    setSavingPermissions(true);
    let hasError = false;

    for (const r of ALL_ROLES) {
      const ids = rolePermissions[r.key] || [];
      const res = await updateRolePermissions(r.key, ids);
      if (res.error) {
        hasError = true;
        toast.error(`Error saving ${r.label}: ${res.error}`);
      }
    }

    setSavingPermissions(false);
    if (!hasError) {
      toast.success('All role privileges updated successfully!');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
          <p className="text-xs text-text-muted">Loading system settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">System Settings & Privileges</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Configure dynamic restaurant branding, contact details, and role-based sidebar menu privileges
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchData}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'general'
              ? 'bg-accent-primary/15 text-accent-primary border border-accent-primary/30 shadow-sm'
              : 'text-text-muted hover:text-text-primary hover:bg-white/5'
            }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Restaurant Branding &amp; Details</span>
        </button>

        <button
          onClick={() => setActiveTab('privileges')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'privileges'
              ? 'bg-accent-primary/15 text-accent-primary border border-accent-primary/30 shadow-sm'
              : 'text-text-muted hover:text-text-primary hover:bg-white/5'
            }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Role Sidebar Privileges</span>
        </button>
      </div>

      {/* TAB 1: GENERAL SYSTEM SETTINGS */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveSettings} className="space-y-6 max-w-full">
          <div className="rounded-3xl glass border border-border p-6 space-y-6 shadow-xl">
            <h2 className="text-sm font-bold text-text-primary border-b border-border pb-3 flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-accent-primary" />
              General Restaurant Branding
            </h2>

            {/* Logo Preview & Upload */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-text-secondary">Restaurant Logo</label>
              <div className="flex items-center gap-4">
                {settingsForm.logo_url ? (
                  <img
                    src={settingsForm.logo_url}
                    alt="Logo Preview"
                    className="w-16 h-16 rounded-2xl object-cover border border-white/20 shadow-md"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-accent-primary/10 border border-dashed border-accent-primary/30 flex flex-col items-center justify-center text-accent-primary shrink-0">
                    <UtensilsCrossed className="w-6 h-6" />
                  </div>
                )}

                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <label className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-text-primary cursor-pointer transition-colors inline-flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-accent-primary" />
                      <span>Upload Logo</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoFileChange} />
                    </label>

                    {settingsForm.logo_url && (
                      <button
                        type="button"
                        onClick={() => setSettingsForm((prev) => ({ ...prev, logo_url: '' }))}
                        className="text-xs text-accent-danger hover:underline cursor-pointer"
                      >
                        Remove Logo
                      </button>
                    )}
                  </div>
                  <Input
                    placeholder="Or paste Logo Image URL (e.g. https://example.com/logo.png)"
                    value={settingsForm.logo_url || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, logo_url: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Restaurant Name *"
                placeholder="e.g. Savoria Gourmet"
                value={settingsForm.restaurant_name || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, restaurant_name: e.target.value })}
                icon={<Building2 className="w-4 h-4" />}
                required
              />

              <Input
                label="Tagline / Motto"
                placeholder="e.g. Fine Dining & Quality Food"
                value={settingsForm.tagline || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, tagline: e.target.value })}
                icon={<UtensilsCrossed className="w-4 h-4" />}
              />

              <Input
                label="Contact Phone"
                placeholder="e.g. +94 11 234 5678"
                value={settingsForm.contact_phone || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, contact_phone: e.target.value })}
                icon={<Phone className="w-4 h-4" />}
              />

              <Input
                label="Contact Email"
                type="email"
                placeholder="e.g. contact@restaurant.com"
                value={settingsForm.contact_email || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, contact_email: e.target.value })}
                icon={<Mail className="w-4 h-4" />}
              />

              <div className="sm:col-span-2">
                <Input
                  label="Restaurant Address"
                  placeholder="e.g. 123 Main Street, Suite 400, Colombo"
                  value={settingsForm.address || ''}
                  onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
                  icon={<MapPin className="w-4 h-4" />}
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <Button variant="primary" type="submit" loading={savingSettings} icon={<Save className="w-4 h-4" />}>
                Save System Settings
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: ROLE SIDEBAR PRIVILEGES */}
      {activeTab === 'privileges' && (
        <div className="space-y-6">
          <div className="rounded-3xl glass border border-border p-6 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <Shield className="w-4 h-4 text-accent-primary" />
                  Dynamic Sidebar Menu Permissions per User Role
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Select which sidebar topics and features each staff role is authorized to view in their navigation
                </p>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveAllPermissions}
                loading={savingPermissions}
                icon={<Save className="w-4 h-4" />}
              >
                Save All Role Privileges
              </Button>
            </div>

            {/* Role Selector Tabs */}
            <div className="flex items-center gap-2 flex-wrap">
              {ALL_ROLES.map((r) => {
                const isSelected = activeRole === r.key;
                const count = (rolePermissions[r.key] || []).length;
                return (
                  <button
                    key={r.key}
                    onClick={() => setActiveRole(r.key)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-2 ${isSelected
                        ? 'bg-accent-primary/15 border-accent-primary text-text-primary shadow-sm'
                        : 'bg-bg-tertiary border-border text-text-muted hover:text-text-primary'
                      }`}
                  >
                    <span>{r.label}</span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-white/10">
                      {count}/{menuItems.length}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Role Privilege Config Panel */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-border">
                <div className="flex items-center gap-2">
                  <Badge variant="completed" className="capitalize">
                    {ALL_ROLES.find((r) => r.key === activeRole)?.label || activeRole}
                  </Badge>
                  <span className="text-xs text-text-muted">
                    {(rolePermissions[activeRole] || []).length} of {menuItems.length} items enabled
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setRolePermissions((prev) => ({
                        ...prev,
                        [activeRole]: menuItems.map((m) => m.id),
                      }))
                    }
                    className="text-xs text-accent-primary hover:underline cursor-pointer font-semibold"
                  >
                    Select All
                  </button>
                  <span className="text-text-muted">•</span>
                  <button
                    onClick={() =>
                      setRolePermissions((prev) => ({
                        ...prev,
                        [activeRole]: [],
                      }))
                    }
                    className="text-xs text-text-muted hover:text-text-primary hover:underline cursor-pointer"
                  >
                    Deselect All
                  </button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleSavePermissions(activeRole)}
                    loading={savingPermissions}
                    className="ml-2 text-xs py-1 px-3"
                    icon={<Check className="w-3.5 h-3.5" />}
                  >
                    Save Role
                  </Button>
                </div>
              </div>

              {/* Grid of Menu Items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {menuItems.map((item) => {
                  const isChecked = (rolePermissions[activeRole] || []).includes(item.id);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => togglePermission(activeRole, item.id)}
                      className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${isChecked
                          ? 'bg-accent-primary/10 border-accent-primary/40 text-text-primary shadow-sm'
                          : 'bg-bg-tertiary/50 border-border text-text-muted hover:border-white/20 hover:text-text-secondary'
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isChecked
                              ? 'bg-accent-primary/20 text-accent-primary'
                              : 'bg-white/5 text-text-muted'
                            }`}
                        >
                          <Sliders className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs truncate">{item.label}</p>
                          <p className="font-mono text-[10px] text-text-muted truncate">{item.href}</p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${isChecked
                            ? 'bg-accent-primary border-accent-primary text-white'
                            : 'border-border bg-bg-secondary'
                          }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
