import { supabase } from './supabase';
import { siteSettingsService } from './siteSettings';
import { ENV } from '../config/env';

const DEFAULT_SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const ACTIVITY_CHECK_INTERVAL_MS = 60 * 1000;

interface StoredSessionInfo {
  sessionId: string;
  auditId: string;
  timestamp: number;
  loginTimestamp: number;
  authToken?: string;
}

class SessionTrackingService {
  private currentSessionId: string | null = null;
  private loginAuditId: string | null = null;
  private lastActivityTime: number = Date.now();
  private activityCheckInterval: NodeJS.Timeout | null = null;
  private sessionTimeoutMs: number = DEFAULT_SESSION_TIMEOUT_MS;
  private activityHandler: (() => void) | null = null;

  async recordLogin(userId: string, email: string, ageVerified: boolean): Promise<string | null> {
    try {
      this.currentSessionId = crypto.randomUUID();

      await this.loadTimeoutSetting();

      // Capture auth token for reliable beforeunload use
      const { data: authData } = await supabase.auth.getSession();
      const authToken = authData.session?.access_token;

      const clientIP = await this.getClientIP();
      const insertPayload: Record<string, unknown> = {
        user_id: userId,
        email: email,
        age_verified: ageVerified,
        session_id: this.currentSessionId,
        login_timestamp: new Date().toISOString(),
        session_ended: false,
        ip_address: clientIP,
        user_agent: navigator.userAgent,
      };

      let { data, error } = await supabase
        .from('login_audit')
        .insert(insertPayload)
        .select('id')
        .single();

      // If the session_ended column doesn't exist yet (migration not run),
      // retry without it so login audit still works.
      if (error?.message?.includes('session_ended')) {
        const { session_ended, ...fallbackPayload } = insertPayload;
        const retry = await supabase
          .from('login_audit')
          .insert(fallbackPayload)
          .select('id')
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error('[SessionTracking] Error recording login:', error.message, error.details, error.hint);
        return null;
      }

      this.loginAuditId = data.id;
      this.storeSessionInfo(this.currentSessionId, data.id, authToken);
      this.startActivityMonitoring();

      return this.currentSessionId;
    } catch (error) {
      console.error('[SessionTracking] Unexpected error in recordLogin:', error);
      return null;
    }
  }

  async recordLogout(): Promise<void> {
    try {
      const sessionInfo = this.getStoredSessionInfo();

      if (!sessionInfo?.auditId) {
        return;
      }

      const logoutTime = new Date().toISOString();
      const sessionDuration = Math.floor((Date.now() - sessionInfo.loginTimestamp) / 1000);

      let { error } = await supabase
        .from('login_audit')
        .update({
          logout_timestamp: logoutTime,
          session_ended: true,
          session_duration: sessionDuration,
        })
        .eq('id', sessionInfo.auditId);

      // Fallback if session tracking columns don't exist yet
      if (error?.message?.includes('session_ended') || error?.message?.includes('session_duration')) {
        const retry = await supabase
          .from('login_audit')
          .update({ logout_timestamp: logoutTime })
          .eq('id', sessionInfo.auditId);
        error = retry.error;
      }

      if (error) {
        console.error('[SessionTracking] Error recording logout:', error.message);
      }

      this.clearSessionInfo();
      this.stopActivityMonitoring();
    } catch (error) {
      console.error('[SessionTracking] Unexpected error in recordLogout:', error);
    }
  }

  // Called when browser/tab is closed — uses keepalive fetch for reliability
  private recordBrowserCloseSync(): void {
    const sessionInfo = this.getStoredSessionInfo();
    if (!sessionInfo?.auditId) return;

    const supabaseUrl = ENV.SUPABASE_URL.replace(/\/$/, '');
    const anonKey = ENV.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) return;

    const sessionDuration = Math.floor((Date.now() - sessionInfo.loginTimestamp) / 1000);
    const authToken = sessionInfo.authToken || anonKey;

    // keepalive: true guarantees the request completes even if the page is unloading
    fetch(`${supabaseUrl}/rest/v1/login_audit?id=eq.${sessionInfo.auditId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${authToken}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        logout_timestamp: new Date().toISOString(),
        session_ended: false,
        session_duration: sessionDuration,
      }),
      keepalive: true,
    }).catch(() => {
      // Intentionally silent — browser may still be closing
    });
  }

  setupBeforeUnloadHandler(): void {
    window.addEventListener('beforeunload', () => {
      this.recordBrowserCloseSync();
    });
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId || this.getStoredSessionInfo()?.sessionId || null;
  }

  private async loadTimeoutSetting(): Promise<void> {
    try {
      const settings = await siteSettingsService.getSettings();
      if (settings.sessionTimeoutMinutes > 0) {
        this.sessionTimeoutMs = settings.sessionTimeoutMinutes * 60 * 1000;
      }
    } catch {
      this.sessionTimeoutMs = DEFAULT_SESSION_TIMEOUT_MS;
    }
  }

  private storeSessionInfo(sessionId: string, auditId: string, authToken?: string): void {
    try {
      const info: StoredSessionInfo = {
        sessionId,
        auditId,
        timestamp: Date.now(),
        loginTimestamp: Date.now(),
        authToken,
      };
      sessionStorage.setItem('session_info', JSON.stringify(info));
    } catch (error) {
      console.error('[SessionTracking] Error storing session info:', error);
    }
  }

  private getStoredSessionInfo(): StoredSessionInfo | null {
    try {
      const stored = sessionStorage.getItem('session_info');
      if (!stored) return null;
      const parsed = JSON.parse(stored) as StoredSessionInfo;
      // Backward compat: old entries didn't have loginTimestamp
      if (!parsed.loginTimestamp) parsed.loginTimestamp = parsed.timestamp;
      return parsed;
    } catch (error) {
      console.error('[SessionTracking] Error reading session info:', error);
      return null;
    }
  }

  private clearSessionInfo(): void {
    try {
      sessionStorage.removeItem('session_info');
      this.currentSessionId = null;
      this.loginAuditId = null;
    } catch (error) {
      console.error('[SessionTracking] Error clearing session info:', error);
    }
  }

  private async getClientIP(): Promise<string | undefined> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const response = await fetch('https://api.ipify.org?format=json', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await response.json();
      return data.ip;
    } catch {
      return undefined;
    }
  }

  private startActivityMonitoring(): void {
    this.stopActivityMonitoring();
    this.lastActivityTime = Date.now();

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    this.activityHandler = () => {
      this.lastActivityTime = Date.now();
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, this.activityHandler!, { passive: true });
    });

    this.activityCheckInterval = setInterval(async () => {
      const timeSinceActivity = Date.now() - this.lastActivityTime;

      if (timeSinceActivity > this.sessionTimeoutMs) {
        await this.handleSessionTimeout();
      }
    }, ACTIVITY_CHECK_INTERVAL_MS);
  }

  private stopActivityMonitoring(): void {
    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval);
      this.activityCheckInterval = null;
    }
    if (this.activityHandler) {
      const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
      activityEvents.forEach(event => {
        window.removeEventListener(event, this.activityHandler!);
      });
      this.activityHandler = null;
    }
  }

  private async handleSessionTimeout(): Promise<void> {
    try {
      await this.recordLogout();
      await supabase.auth.signOut();

      window.location.href = '/?session_expired=true';
    } catch (error) {
      console.error('[SessionTracking] Error handling session timeout:', error);
    }
  }
}

export const sessionTrackingService = new SessionTrackingService();
