import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://njmcifegeristznahthz.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_-Vjw5apegVogIX0awpBJYg_Q8knV8EL';

// Choose storage dynamically based on user's login preference
const getAuthStorage = () => {
  if (typeof window === 'undefined') return undefined;
  const keepLoggedIn = localStorage.getItem('sgj_keep_logged_in') === 'true';
  return keepLoggedIn ? localStorage : sessionStorage;
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: getAuthStorage(),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Helper to switch storage dynamically and re-create client if needed
// (Supabase allows changing storage settings by re-instantiating, or reload)
export const setSessionPersistence = (keep) => {
  localStorage.setItem('sgj_keep_logged_in', keep ? 'true' : 'false');
};
