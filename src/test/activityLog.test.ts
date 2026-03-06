import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock('../services/supabase', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('../services/sessionTracking', () => ({
  sessionTrackingService: {
    getCurrentSessionId: () => 'test-session-123',
  },
}));

describe('ActivityLogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a log entry with correct fields', async () => {
    // Fresh import to reset singleton state
    vi.resetModules();
    const { activityLogService } = await import('../services/activityLog');
    mockInsert.mockResolvedValue({ error: null });

    await activityLogService.logAction({
      userId: 'user-1',
      action: 'order_placed',
      resourceType: 'order',
      resourceId: 'order-123',
      details: { total: 99.99 },
    });

    expect(mockFrom).toHaveBeenCalledWith('user_activity_log');
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      session_id: 'test-session-123',
      action: 'order_placed',
      resource_type: 'order',
      resource_id: 'order-123',
      details: { total: 99.99 },
    });
  });

  it('defaults optional fields to null', async () => {
    vi.resetModules();
    const { activityLogService } = await import('../services/activityLog');
    mockInsert.mockResolvedValue({ error: null });

    await activityLogService.logAction({
      userId: 'user-1',
      action: 'login',
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        resource_type: null,
        resource_id: null,
        details: null,
      })
    );
  });

  it('suppresses future calls when table does not exist (42P01)', async () => {
    vi.resetModules();
    const { activityLogService } = await import('../services/activityLog');
    mockInsert.mockResolvedValue({ error: { code: '42P01', message: 'relation does not exist' } });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // First call should warn
    await activityLogService.logAction({ userId: 'user-1', action: 'login' });
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // Reset mock call counts
    mockFrom.mockClear();
    mockInsert.mockClear();

    // Second call should be suppressed entirely — no DB call
    await activityLogService.logAction({ userId: 'user-1', action: 'logout' });
    expect(mockFrom).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('handles unexpected errors gracefully', async () => {
    vi.resetModules();
    const { activityLogService } = await import('../services/activityLog');
    mockInsert.mockRejectedValue(new Error('network error'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      activityLogService.logAction({ userId: 'user-1', action: 'login' })
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
