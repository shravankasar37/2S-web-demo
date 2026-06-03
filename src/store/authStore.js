import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export const useAuthStore = create((set) => ({
  session: null,
  user: null,
  loading: true,

  initialize: async () => {
    set({ loading: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      set({ 
        session, 
        user: session?.user || null, 
        loading: false 
      });
    } catch (error) {
      console.error('Error fetching initial session:', error);
      set({ loading: false });
    }

    // Set up real-time listener for authentication status changes
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ 
        session, 
        user: session?.user || null,
        loading: false
      });
    });
  },

  setSession: (session) => {
    set({ session, user: session?.user || null });
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out from Supabase:', error);
    }
    set({ session: null, user: null });
    // Clear storage keys if needed
    sessionStorage.clear();
  }
}));
