import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import type { Profile } from '../services/supabase';
import { sessionTrackingService } from '../services/sessionTracking';
import { activityLogService } from '../services/activityLog';

interface ImpersonationState {
  userId: string;
  profile: Profile;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  impersonation: ImpersonationState | null;
  isImpersonating: boolean;
  effectiveUserId: string | null;
  effectiveProfile: Profile | null;
  startImpersonation: (userId: string) => Promise<void>;
  stopImpersonation: () => void;
  signUp: (email: string, password: string, captchaToken?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string, ageVerified: boolean, captchaToken?: string) => Promise<{ error: any }>;
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
  const [impersonation, setImpersonation] = useState<ImpersonationState | null>(null);

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
          // On token refresh (e.g. window regaining focus), skip re-fetching
          // the profile if we already have it — avoids flashing a loading
          // spinner and unmounting the dashboard.
          if (event === 'TOKEN_REFRESHED') {
            return;
          }
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
      // Only show the global loading spinner on initial load, not on
      // background re-fetches — setting loading=true unmounts the entire
      // app shell (including the admin dashboard) causing tab state loss.
      if (!profile) {
        setLoading(true);
      }
      
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

  const signUp = async (email: string, password: string, captchaToken?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
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

  const signIn = async (email: string, password: string, ageVerified: boolean, captchaToken?: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
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

    // Only allow safe fields to be updated from the client
    const { role, approval_status, approved, can_view_secret_cost, id, created_at, ...safeUpdates } = updates as any;

    const { error } = await supabase
      .from('profiles')
      .update(safeUpdates)
      .eq('id', user.id);

    if (!error) {
      setProfile({ ...profile, ...safeUpdates });
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

  const startImpersonation = async (userId: string) => {
    if (profile?.role !== 'admin' || !user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      console.error('Failed to load impersonated user profile:', error);
      return;
    }

    // Log impersonation event for audit trail
    try {
      await supabase.from('login_audit').insert({
        user_id: user.id,
        email: user.email,
        session_id: `impersonation_${crypto.randomUUID()}`,
        login_timestamp: new Date().toISOString(),
        session_ended: false,
        user_agent: `IMPERSONATION: admin ${user.id} impersonating ${userId}`,
      });
    } catch (auditErr) {
      console.error('Failed to log impersonation event:', auditErr);
    }

    setImpersonation({ userId, profile: data });

    // Log impersonation start as a user action
    activityLogService.logAction({
      userId: user.id,
      action: 'impersonation_started',
      resourceType: 'user',
      resourceId: userId,
      details: { impersonated_email: data.email, impersonated_role: data.role },
    });
  };

  const stopImpersonation = () => {
    if (user && impersonation) {
      activityLogService.logAction({
        userId: user.id,
        action: 'impersonation_stopped',
        resourceType: 'user',
        resourceId: impersonation.userId,
        details: { impersonated_email: impersonation.profile.email },
      });
    }
    setImpersonation(null);
  };

  const isImpersonating = impersonation !== null;
  const effectiveUserId = impersonation?.userId ?? user?.id ?? null;
  const effectiveProfile = impersonation?.profile ?? profile;

  const value = {
    user,
    session,
    profile,
    loading,
    isPasswordRecovery,
    impersonation,
    isImpersonating,
    effectiveUserId,
    effectiveProfile,
    startImpersonation,
    stopImpersonation,
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