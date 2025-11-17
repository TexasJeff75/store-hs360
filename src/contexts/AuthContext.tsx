import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import type { Profile } from '../services/supabase';

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
    let mounted = true;
    
    // Get initial session with proper error handling
    const initializeAuth = async () => {
      try {
        console.log('Initializing authentication...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          
          // Handle invalid refresh token by clearing stale session data
          if (error.message?.includes('refresh_token_not_found') || 
              error.message?.includes('Invalid Refresh Token')) {
            console.log('Invalid refresh token detected, clearing session...');
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
        
        console.log('Initial session:', session?.user?.email || 'No session');
        
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
      console.log('Auth state changed:', event, session?.user?.email);

      if (mounted) {
        // Handle password recovery event
        if (event === 'PASSWORD_RECOVERY') {
          console.log('Password recovery event detected');
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
      console.log('Fetching profile for user:', userId);
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
          console.log('Profile not found, will be created on next sign up');
        }
        setProfile(null);
      } else if (data) {
        console.log('Profile fetched successfully:', {
          email: data.email,
          role: data.role,
          approved: data.approved
        });
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
    console.log('Attempting sign up for:', email);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    console.log('Sign up result:', { data, error });

    if (!error && data.user) {
      // Create profile
      console.log('Creating profile for user:', data.user.id);
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
        console.log('Profile created successfully');
      }
    }

    return { error };
  };

  const signIn = async (email: string, password: string, ageVerified: boolean) => {
    console.log('Attempting sign in for:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log('Sign in result:', { error });

    if (!error && data.user) {
      // Log audit record asynchronously without blocking login
      setTimeout(async () => {
        try {
          const { error: auditError } = await supabase
            .from('login_audit')
            .insert([
              {
                user_id: data.user.id,
                email: data.user.email,
                age_verified: ageVerified,
                login_timestamp: new Date().toISOString(),
              },
            ]);

          if (auditError) {
            console.error('Error logging audit record:', auditError);
          } else {
            console.log('Login audit record created successfully');
          }
        } catch (auditException) {
          console.error('Failed to create audit log:', auditException);
        }
      }, 100);
    }

    return { error };
  };

  const signOut = async () => {
    console.log('Signing out user');
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
    console.log('Attempting to reset password');
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (!error) {
      console.log('Password reset successful');
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