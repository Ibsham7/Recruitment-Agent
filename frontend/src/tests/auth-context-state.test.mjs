import test from 'node:test';
import assert from 'node:assert/strict';

// Test mock implementation of AuthContext profile fetching and state management logic

class MockAuthStore {
  constructor() {
    this.session = null;
    this.user = null;
    this.profile = null;
    this.isAdmin = false;
    this.isLoading = true;
    this.apiFetchMock = null;
    this.getSessionMock = null;
  }

  async fetchProfile(currentSession) {
    if (!currentSession?.access_token) {
      this.profile = null;
      this.isAdmin = false;
      return;
    }
    try {
      const res = await this.apiFetchMock();
      if (res.ok) {
        const data = await res.json();
        this.profile = data.profile || null;
        this.isAdmin = Boolean(data.isAdmin);
      }
    } catch (err) {
      // console.warn('[AuthContext] Failed to load user profile:', err);
    }
  }

  async refreshProfile() {
    const { data: { session: curSession } } = await this.getSessionMock();
    await this.fetchProfile(curSession);
  }

  handleAuthStateChange(event, session) {
    this.session = session;
    this.user = session?.user ?? null;
    if (session) {
      return this.fetchProfile(session);
    } else {
      this.profile = null;
      this.isAdmin = false;
    }
  }
}

test('AuthContext: No session resets profile to null and isAdmin to false', async () => {
  const store = new MockAuthStore();
  store.profile = { id: 'u1', plan: 'free' };
  store.isAdmin = true;

  await store.fetchProfile(null);
  assert.equal(store.profile, null);
  assert.equal(store.isAdmin, false);

  await store.fetchProfile({ access_token: '' });
  assert.equal(store.profile, null);
  assert.equal(store.isAdmin, false);
});

test('AuthContext: Valid session with standard user profile populates state and isAdmin=false', async () => {
  const store = new MockAuthStore();
  const mockUserPayload = {
    profile: {
      id: 'profile-1',
      userId: 'user-1',
      email: 'candidate_user@example.com',
      plan: 'free',
      creditBalance: 0,
      totalCampaignsCreated: 1,
      totalCvsProcessed: 12,
      totalInterviewsSent: 0,
      createdAt: '2026-08-20T10:00:00Z',
      updatedAt: '2026-08-20T10:00:00Z',
    },
    isAdmin: false,
  };

  store.apiFetchMock = async () => ({
    ok: true,
    json: async () => mockUserPayload,
  });

  await store.fetchProfile({ access_token: 'valid-jwt-token' });
  assert.deepEqual(store.profile, mockUserPayload.profile);
  assert.equal(store.isAdmin, false);
});

test('AuthContext: Valid session with admin user profile sets isAdmin=true', async () => {
  const store = new MockAuthStore();
  const mockAdminPayload = {
    profile: {
      id: 'profile-admin',
      userId: 'admin-1',
      email: 'admin@company.com',
      plan: 'paid',
      creditBalance: 5000,
      totalCampaignsCreated: 25,
      totalCvsProcessed: 890,
      totalInterviewsSent: 40,
      createdAt: '2026-08-01T10:00:00Z',
      updatedAt: '2026-08-20T10:00:00Z',
    },
    isAdmin: true,
  };

  store.apiFetchMock = async () => ({
    ok: true,
    json: async () => mockAdminPayload,
  });

  await store.fetchProfile({ access_token: 'admin-jwt-token' });
  assert.deepEqual(store.profile, mockAdminPayload.profile);
  assert.equal(store.isAdmin, true);
  assert.equal(store.profile.plan, 'paid');
  assert.equal(store.profile.creditBalance, 5000);
});

test('AuthContext: API network failure gracefully keeps application alive without unhandled rejection', async () => {
  const store = new MockAuthStore();
  store.apiFetchMock = async () => {
    throw new Error('500 Internal Server Error / Network unreachable');
  };

  // Should not throw
  await store.fetchProfile({ access_token: 'valid-jwt' });
  assert.equal(store.profile, null);
  assert.equal(store.isAdmin, false);
});

test('AuthContext: refreshProfile queries getSession and triggers fetchProfile', async () => {
  const store = new MockAuthStore();
  let refreshedProfile = {
    profile: {
      id: 'p1',
      userId: 'u1',
      email: 'refreshed@example.com',
      plan: 'paid',
      creditBalance: 1000,
      totalCampaignsCreated: 3,
      totalCvsProcessed: 50,
      totalInterviewsSent: 2,
      createdAt: '2026-08-01',
      updatedAt: '2026-08-24',
    },
    isAdmin: false,
  };

  store.getSessionMock = async () => ({
    data: { session: { access_token: 'refreshed-jwt', user: { id: 'u1' } } },
  });

  store.apiFetchMock = async () => ({
    ok: true,
    json: async () => refreshedProfile,
  });

  await store.refreshProfile();
  assert.equal(store.profile.creditBalance, 1000);
  assert.equal(store.profile.plan, 'paid');
});

test('AuthContext: AuthStateChange SIGNED_OUT cleans state immediately', async () => {
  const store = new MockAuthStore();
  store.profile = { id: 'p1', plan: 'paid', creditBalance: 100 };
  store.isAdmin = true;
  store.user = { id: 'u1' };
  store.session = { access_token: 'token' };

  store.handleAuthStateChange('SIGNED_OUT', null);
  assert.equal(store.session, null);
  assert.equal(store.user, null);
  assert.equal(store.profile, null);
  assert.equal(store.isAdmin, false);
});
