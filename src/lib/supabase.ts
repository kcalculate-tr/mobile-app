import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://xtjakvinklthlvsfcncu.supabase.co';
const supabaseAnonKey = 'sb_publishable_tjeQHxsEgZIObTyf1UHz5Q_Bh4jqS29';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const getSupabaseClient = () => supabase;

export const getSupabaseConfigStatus = () => ({
  isValid: true,
  missingKeys: [] as string[],
});

export class SupabaseConfigError extends Error {
  constructor(missingKeys: string[]) {
    super(`Missing Supabase configuration: ${missingKeys.join(', ')}`);
    this.name = 'SupabaseConfigError';
  }
}

export const isSupabaseConfigError = (e: unknown): e is SupabaseConfigError =>
  e instanceof SupabaseConfigError;
