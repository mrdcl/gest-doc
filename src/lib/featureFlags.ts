interface FeatureFlags {
  useHydraAuth: boolean;
  useCloudflareR2: boolean;
  useNeonDatabase: boolean;
  usePostgREST: boolean;
  enableSemanticSearch: boolean;
  enableWorkflowSystem: boolean;
  enableSharedLinks: boolean;
  enableTwoFactorAuth: boolean;
  enableTelemetry: boolean;
  enableAuditLogs: boolean;
}

interface ProviderConfig {
  auth: {
    provider: 'supabase' | 'hydra';
    supabase?: {
      url: string;
      anonKey: string;
    };
    hydra?: {
      publicUrl: string;
      adminUrl: string;
      clientId: string;
      clientSecret: string;
    };
  };
  storage: {
    provider: 'supabase' | 'r2';
    supabase?: {
      bucket: string;
    };
    r2?: {
      accountId: string;
      accessKeyId: string;
      bucket: string;
      publicUrl: string;
    };
  };
  database: {
    provider: 'supabase' | 'neon';
    connectionString?: string;
  };
  api: {
    provider: 'supabase' | 'postgrest';
    supabase?: {
      url: string;
      anonKey: string;
    };
    postgrest?: {
      url: string;
    };
  };
}

class FeatureFlagManager {
  private flags: FeatureFlags;
  private config: ProviderConfig;
  private listeners: Map<keyof FeatureFlags, Set<(enabled: boolean) => void>>;

  constructor() {
    this.listeners = new Map();
    this.flags = this.loadFlags();
    this.config = this.loadConfig();
  }

  private loadFlags(): FeatureFlags {
    const stored = localStorage.getItem('feature_flags');
    const defaults: FeatureFlags = {
      useHydraAuth: false,
      useCloudflareR2: false,
      useNeonDatabase: false,
      usePostgREST: false,
      enableSemanticSearch: import.meta.env.VITE_OLLAMA_BASE_URL !== undefined,
      enableWorkflowSystem: true,
      enableSharedLinks: true,
      enableTwoFactorAuth: true,
      enableTelemetry: import.meta.env.VITE_POSTHOG_API_KEY !== undefined,
      enableAuditLogs: true,
    };

    if (stored) {
      try {
        return { ...defaults, ...JSON.parse(stored) };
      } catch (e) {
        console.error('Failed to parse feature flags:', e);
      }
    }

    return defaults;
  }

  private loadConfig(): ProviderConfig {
    const stored = localStorage.getItem('provider_config');
    const defaults: ProviderConfig = {
      auth: {
        provider: 'supabase',
        supabase: {
          url: import.meta.env.VITE_SUPABASE_URL,
          anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      },
      storage: {
        provider: 'supabase',
        supabase: {
          bucket: 'documents',
        },
      },
      database: {
        provider: 'supabase',
      },
      api: {
        provider: 'supabase',
        supabase: {
          url: import.meta.env.VITE_SUPABASE_URL,
          anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      },
    };

    if (stored) {
      try {
        return { ...defaults, ...JSON.parse(stored) };
      } catch (e) {
        console.error('Failed to parse provider config:', e);
      }
    }

    return defaults;
  }

  private saveFlags(): void {
    localStorage.setItem('feature_flags', JSON.stringify(this.flags));
  }

  private saveConfig(): void {
    localStorage.setItem('provider_config', JSON.stringify(this.config));
  }

  isEnabled(flag: keyof FeatureFlags): boolean {
    return this.flags[flag] ?? false;
  }

  enable(flag: keyof FeatureFlags): void {
    if (this.flags[flag] !== true) {
      this.flags[flag] = true;
      this.saveFlags();
      this.notifyListeners(flag, true);
    }
  }

  disable(flag: keyof FeatureFlags): void {
    if (this.flags[flag] !== false) {
      this.flags[flag] = false;
      this.saveFlags();
      this.notifyListeners(flag, false);
    }
  }

  toggle(flag: keyof FeatureFlags): void {
    if (this.flags[flag]) {
      this.disable(flag);
    } else {
      this.enable(flag);
    }
  }

  setFlags(newFlags: Partial<FeatureFlags>): void {
    const changedFlags: Array<keyof FeatureFlags> = [];

    for (const [key, value] of Object.entries(newFlags)) {
      const flagKey = key as keyof FeatureFlags;
      if (this.flags[flagKey] !== value) {
        this.flags[flagKey] = value as boolean;
        changedFlags.push(flagKey);
      }
    }

    if (changedFlags.length > 0) {
      this.saveFlags();
      changedFlags.forEach(flag => {
        this.notifyListeners(flag, this.flags[flag]);
      });
    }
  }

  getAllFlags(): Readonly<FeatureFlags> {
    return { ...this.flags };
  }

  getConfig(): Readonly<ProviderConfig> {
    return JSON.parse(JSON.stringify(this.config));
  }

  updateConfig(updates: Partial<ProviderConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
      auth: { ...this.config.auth, ...updates.auth },
      storage: { ...this.config.storage, ...updates.storage },
      database: { ...this.config.database, ...updates.database },
      api: { ...this.config.api, ...updates.api },
    };
    this.saveConfig();
  }

  getAuthProvider(): 'supabase' | 'hydra' {
    return this.flags.useHydraAuth ? 'hydra' : 'supabase';
  }

  getStorageProvider(): 'supabase' | 'r2' {
    return this.flags.useCloudflareR2 ? 'r2' : 'supabase';
  }

  getDatabaseProvider(): 'supabase' | 'neon' {
    return this.flags.useNeonDatabase ? 'neon' : 'supabase';
  }

  getApiProvider(): 'supabase' | 'postgrest' {
    return this.flags.usePostgREST ? 'postgrest' : 'supabase';
  }

  subscribe(flag: keyof FeatureFlags, callback: (enabled: boolean) => void): () => void {
    if (!this.listeners.has(flag)) {
      this.listeners.set(flag, new Set());
    }

    const callbacks = this.listeners.get(flag)!;
    callbacks.add(callback);

    return () => {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(flag);
      }
    };
  }

  private notifyListeners(flag: keyof FeatureFlags, enabled: boolean): void {
    const callbacks = this.listeners.get(flag);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(enabled);
        } catch (e) {
          console.error(`Error in feature flag listener for ${flag}:`, e);
        }
      });
    }
  }

  reset(): void {
    localStorage.removeItem('feature_flags');
    localStorage.removeItem('provider_config');
    this.flags = this.loadFlags();
    this.config = this.loadConfig();

    Object.keys(this.flags).forEach(key => {
      this.notifyListeners(key as keyof FeatureFlags, this.flags[key as keyof FeatureFlags]);
    });
  }

  exportConfig(): string {
    return JSON.stringify({
      flags: this.flags,
      config: this.config,
    }, null, 2);
  }

  importConfig(jsonConfig: string): boolean {
    try {
      const parsed = JSON.parse(jsonConfig);
      if (parsed.flags) {
        this.setFlags(parsed.flags);
      }
      if (parsed.config) {
        this.updateConfig(parsed.config);
      }
      return true;
    } catch (e) {
      console.error('Failed to import config:', e);
      return false;
    }
  }
}

export const featureFlags = new FeatureFlagManager();

export type { FeatureFlags, ProviderConfig };
