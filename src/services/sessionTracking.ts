import { supabase } from './supabase';
import { siteSettingsService } from './siteSettings';

const DEFAULT_SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const ACTIVITY_CHECK_INTERVAL_MS = 60 * 1000;

class SessionTrackingService {
  private currentSessionId: string | null = null;
  private loginAuditId: string | null = null;
  private lastActivityTime: number = Date.now();
  private activityCheckInterval: NodeJS.Timeout | null = null;
  private sessionTimeoutMs: number = DEFAULT_SESSION_TIMEOUT_MS;

  async recordLogin(userId: string, email: string, ageVerified: boolean): Promise<string | null> {
    try {
      this.currentSessionId = crypto.randomUUID();

      await this.loadTimeoutSetting();

      const { data, error } = await supabase
        .from('login_audit')
        .insert({
          user_id: userId,
          email: email,
          age_verified: ageVerified,
          session_id: this.currentSessionId,
          login_timestamp: new Date().toISOString(),
          session_ended: false,
          ip_address: await this.getClientIP(),
          user_agent: navigator.userAgent
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error recording login:', error);
        return null;
      }

      this.loginAuditId = data.id;
      this.storeSessionInfo(this.currentSessionId, data.id);
      this.startActivityMonitoring();

      return this.currentSessionId;
    } catch (error) {
      console.error('Error in recordLogin:', error);
      return null;
    }
  }

  async recordLogout(): Promise<void> {
    try {
      const sessionInfo = this.getStoredSessionInfo();

      if (!sessionInfo?.auditId) {
        return;
      }

      const { error } = await supabase
        .from('login_audit')
        .update({
          logout_timestamp: new Date().toISOString(),
          session_ended: true
        })
        .eq('id', sessionInfo.auditId);

      if (error) {
        console.error('Error recording logout:', error);
      }

      this.clearSessionInfo();
      this.stopActivityMonitoring();
    } catch (error) {
      console.error('Error in recordLogout:', error);
    }
  }

  async recordBrowserClose(): Promise<void> {
    try {
      const sessionInfo = this.getStoredSessionInfo();

      if (!sessionInfo?.auditId) {
        return;
      }

      const { error } = await supabase
        .from('login_audit')
        .update({
          logout_timestamp: new Date().toISOString(),
          session_ended: false
        })
        .eq('id', sessionInfo.auditId);

      if (error) {
        console.error('Error recording browser close:', error);
      }
    } catch (error) {
      console.error('Error in recordBrowserClose:', error);
    }
  }

  setupBeforeUnloadHandler(): void {
    window.addEventListener('beforeunload', () => {
      this.recordBrowserClose();
    });
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

  private storeSessionInfo(sessionId: string, auditId: string): void {
    try {
      sessionStorage.setItem('session_info', JSON.stringify({
        sessionId,
        auditId,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error storing session info:', error);
    }
  }

  private getStoredSessionInfo(): { sessionId: string; auditId: string; timestamp: number } | null {
    try {
      const stored = sessionStorage.getItem('session_info');
      if (!stored) return null;
      return JSON.parse(stored);
    } catch (error) {
      console.error('Error reading session info:', error);
      return null;
    }
  }

  private clearSessionInfo(): void {
    try {
      sessionStorage.removeItem('session_info');
      this.currentSessionId = null;
      this.loginAuditId = null;
    } catch (error) {
      console.error('Error clearing session info:', error);
    }
  }

  private async getClientIP(): Promise<string | undefined> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      return undefined;
    }
  }

  private startActivityMonitoring(): void {
    this.lastActivityTime = Date.now();

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    const updateActivity = () => {
      this.lastActivityTime = Date.now();
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true });
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
  }

  private async handleSessionTimeout(): Promise<void> {
    try {
      await this.recordLogout();
      await supabase.auth.signOut();

      window.location.href = '/?session_expired=true';
    } catch (error) {
      console.error('Error handling session timeout:', error);
    }
  }
}

export const sessionTrackingService = new SessionTrackingService();
