import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import type { Profile } from '../services/supabase';
import { sessionTrackingService } from '../services/sessionTracking';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string, ageVerified: boolean) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>;
  resetPassword: (newPassword: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    sessionTrackingService.setupBeforeUnloadHandler();
  }, []);

  useEffect(() => {
    let mounted = true;
    
    // Get initial session with proper error handling
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          
          // Handle invalid refresh token by clearing stale session data
          if (error.message?.includes('refresh_token_not_found') || 
              error.message?.includes('Invalid Refresh Token')) {
            await supabase.auth.signOut();
          }
          
          if (mounted) {
            setSession(null);
            setUser(null);
            setProfile(null);
            setLoading(false);
          }
          return;
        }
        
        
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            await fetchProfile(session.user.id);
          } else {
            setProfile(null);
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        if (mounted) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    };
    
    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {

      if (mounted) {
        // Handle password recovery event
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
          return;
        }

        // Reset password recovery flag on signed in after recovery
        if (event === 'SIGNED_IN') {
          setIsPasswordRecovery(false);
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          if (mounted) {
            setLoading(false);
          }
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      setLoading(true);
      
      // Check if Supabase is properly configured
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        console.error('Supabase environment variables not configured');
        setProfile(null);
        setLoading(false);
        return;
      }
      
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      let data, error;
      try {
        const result = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        data = result.data;
        error = result.error;
      } catch (fetchError) {
        console.error('Network error fetching profile:', fetchError);
        setProfile(null);
        setLoading(false);
        return;
      }
      
      clearTimeout(timeoutId);

      if (error) {
        console.error('Error fetching profile:', error);
        if (error.code === 'PGRST116') {
        }
        setProfile(null);
      } else if (data) {
        setProfile(data);
      } else {
        console.warn('No profile data returned for user:', userId);
        setProfile(null);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Profile fetch timed out');
      } else if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.error('Network connection failed - check Supabase URL and network connectivity');
      } else {
        console.error('Error fetching profile:', error);
      }
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });


    if (!error && data.user) {
      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: data.user.id,
            email: data.user.email,
            role: 'pending',
            is_approved: false,
          },
        ]);

      if (profileError) {
        console.error('Error creating profile:', profileError);
      } else {
      }
    }

    return { error };
  };

  const signIn = async (email: string, password: string, ageVerified: boolean) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data.user) {
      await sessionTrackingService.recordLogin(
        data.user.id,
        data.user.email || email,
        ageVerified
      );
    }

    return { error };
  };

  const signOut = async () => {
    await sessionTrackingService.recordLogout();
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user logged in') };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (!error) {
      setProfile({ ...profile, ...updates });
    }

    return { error };
  };

  const resetPassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (!error) {
      setIsPasswordRecovery(false);
    } else {
      console.error('Password reset failed:', error);
    }

    return { error };
  };

  const value = {
    user,
    session,
    profile,
    loading,
    isPasswordRecovery,
    signUp,
    signIn,
    signOut,
    updateProfile,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}