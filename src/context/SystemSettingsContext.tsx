'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SystemSettings } from '@/types/database';
import { RESTAURANT_NAME, RESTAURANT_TAGLINE } from '@/lib/constants';

interface SystemSettingsContextType {
  settings: SystemSettings | null;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SystemSettingsContext = createContext<SystemSettingsContextType>({
  settings: null,
  loading: true,
  refreshSettings: async () => {},
});

export function SystemSettingsProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching system settings:', error);
        // Fallback to defaults
        setSettings({
          id: '',
          restaurant_name: RESTAURANT_NAME,
          tagline: RESTAURANT_TAGLINE,
          address: null,
          contact_phone: null,
          contact_email: null,
          logo_url: null,
          updated_at: '',
          created_at: '',
        });
      } else if (data) {
        setSettings(data);
      } else {
        // No row in DB yet — use defaults
        setSettings({
          id: '',
          restaurant_name: RESTAURANT_NAME,
          tagline: RESTAURANT_TAGLINE,
          address: null,
          contact_phone: null,
          contact_email: null,
          logo_url: null,
          updated_at: '',
          created_at: '',
        });
      }
    } catch (err) {
      console.error('Error in SystemSettingsContext:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  return (
    <SystemSettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </SystemSettingsContext.Provider>
  );
}

export function useSystemSettings() {
  const context = useContext(SystemSettingsContext);
  if (!context) {
    throw new Error('useSystemSettings must be used within a SystemSettingsProvider');
  }
  return context;
}
