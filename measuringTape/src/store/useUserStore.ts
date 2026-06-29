/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { UserProfile, UserRole } from '../types/user';
import { getVotingWeight } from '../utils/consensus';
import { Locality } from '../types/locality';

interface UserState {
  currentUser: UserProfile | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  signup: (
    username: string,
    password: string,
    role: UserRole,
    subscribedLocalities: Locality[],
    walletAddress: string
  ) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  connectWallet: (address: string) => Promise<void>;
  disconnect: () => void;
  subscribeToLocality: (locality: Locality) => Promise<void>;
  unsubscribeFromLocality: (localityId: string) => Promise<void>;
  updateReputation: (adjustment: number) => void;
  clearError: () => void;
}

/**
 * State management store for User profiles, authentication, and locality subscriptions.
 */
export const useUserStore = create<UserState>((set, get) => ({
  currentUser: (() => {
    try {
      const saved = localStorage.getItem('mt_user_profile');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  })(),
  isLoading: false,
  error: null,

  signup: async (username, password, role, subscribedLocalities, walletAddress) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          role,
          subscribedLocalities,
          walletAddress,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Signup failed');
      }

      const { user } = await res.json();
      
      const profile: UserProfile = {
        address: user.walletAddress,
        username: user.username,
        role: user.role,
        subscribedLocalities: user.subscribedLocalities,
        reputation: {
          address: user.walletAddress,
          score: user.reputationPoints || 0,
          votingWeight: getVotingWeight(user.reputationPoints || 0),
          correctVerifications: 0,
          correctResolutions: 0,
          incorrectVerifications: 0,
          failedChallenges: 0,
          lastUpdated: new Date().toISOString(),
        },
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      try {
        localStorage.setItem('mt_user_profile', JSON.stringify(profile));
      } catch (e) {}

      set({ currentUser: profile, isLoading: false });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      set({ error: errorMessage, isLoading: false });
      throw err;
    }
  },

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Invalid credentials');
      }

      const { user } = await res.json();
      
      const profile: UserProfile = {
        address: user.walletAddress,
        username: user.username,
        role: user.role,
        subscribedLocalities: user.subscribedLocalities,
        reputation: {
          address: user.walletAddress,
          score: user.reputationPoints || 0,
          votingWeight: getVotingWeight(user.reputationPoints || 0),
          correctVerifications: 0,
          correctResolutions: 0,
          incorrectVerifications: 0,
          failedChallenges: 0,
          lastUpdated: new Date().toISOString(),
        },
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      try {
        localStorage.setItem('mt_user_profile', JSON.stringify(profile));
      } catch (e) {}

      set({ currentUser: profile, isLoading: false });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      set({ error: errorMessage, isLoading: false });
      throw err;
    }
  },

  connectWallet: async (address: string) => {
    set({ isLoading: true, error: null });
    try {
      // Connect to existing account or login, fallback to mock Profile
      const mockProfile: UserProfile = {
        address,
        username: `Citizen_${address.substring(0, 6)}`,
        role: UserRole.CITIZEN,
        subscribedLocalities: [],
        reputation: {
          address,
          score: 0,
          votingWeight: 1,
          correctVerifications: 0,
          correctResolutions: 0,
          incorrectVerifications: 0,
          failedChallenges: 0,
          lastUpdated: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        localStorage.setItem('mt_user_profile', JSON.stringify(mockProfile));
      } catch (e) {}

      set({ currentUser: mockProfile, isLoading: false });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet';
      set({ error: errorMessage, isLoading: false });
    }
  },

  disconnect: () => {
    try {
      localStorage.removeItem('mt_user_profile');
      localStorage.removeItem('mt_active_tab');
    } catch (e) {}
    set({ currentUser: null, error: null });
  },

  subscribeToLocality: async (locality: Locality) => {
    set({ isLoading: true, error: null });
    try {
      const currentUser = get().currentUser;
      if (!currentUser) throw new Error('No user logged in');

      const updatedLocalities = [...currentUser.subscribedLocalities];
      if (updatedLocalities.some(l => l.id === locality.id)) {
        set({ isLoading: false });
        return;
      }
      updatedLocalities.push(locality);

      const res = await fetch('/api/auth/update-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          subscribedLocalities: updatedLocalities,
        }),
      });

      if (!res.ok) throw new Error('Failed to update subscriptions on server');

      const updatedUser: UserProfile = {
        ...currentUser,
        subscribedLocalities: updatedLocalities,
        updatedAt: new Date().toISOString(),
      };

      try {
        localStorage.setItem('mt_user_profile', JSON.stringify(updatedUser));
      } catch (e) {}

      set({ currentUser: updatedUser, isLoading: false });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Subscription failed';
      set({ error: errorMessage, isLoading: false });
    }
  },

  unsubscribeFromLocality: async (localityId: string) => {
    set({ isLoading: true, error: null });
    try {
      const currentUser = get().currentUser;
      if (!currentUser) throw new Error('No user logged in');

      const updatedLocalities = currentUser.subscribedLocalities.filter((l) => l.id !== localityId);

      const res = await fetch('/api/auth/update-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          subscribedLocalities: updatedLocalities,
        }),
      });

      if (!res.ok) throw new Error('Failed to update subscriptions on server');

      const updatedUser: UserProfile = {
        ...currentUser,
        subscribedLocalities: updatedLocalities,
        updatedAt: new Date().toISOString(),
      };

      try {
        localStorage.setItem('mt_user_profile', JSON.stringify(updatedUser));
      } catch (e) {}

      set({ currentUser: updatedUser, isLoading: false });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unsubscription failed';
      set({ error: errorMessage, isLoading: false });
    }
  },

  updateReputation: (adjustment: number) => {
    set((state) => {
      if (!state.currentUser) return {};

      const currentScore = state.currentUser.reputation.score + adjustment;
      const newWeight = getVotingWeight(currentScore);

      const updatedReputation = {
        ...state.currentUser.reputation,
        score: currentScore,
        votingWeight: newWeight,
        correctVerifications:
          adjustment === 5
            ? state.currentUser.reputation.correctVerifications + 1
            : state.currentUser.reputation.correctVerifications,
        correctResolutions:
          adjustment === 10
            ? state.currentUser.reputation.correctResolutions + 1
            : state.currentUser.reputation.correctResolutions,
        incorrectVerifications:
          adjustment === -3
            ? state.currentUser.reputation.incorrectVerifications + 1
            : state.currentUser.reputation.incorrectVerifications,
        failedChallenges:
          adjustment === -5
            ? state.currentUser.reputation.failedChallenges + 1
            : state.currentUser.reputation.failedChallenges,
        lastUpdated: new Date().toISOString(),
      };

      const updatedUser = {
        ...state.currentUser,
        reputation: updatedReputation,
        updatedAt: new Date().toISOString(),
      };

      try {
        localStorage.setItem('mt_user_profile', JSON.stringify(updatedUser));
      } catch (e) {}

      return {
        currentUser: updatedUser,
      };
    });
  },

  clearError: () => set({ error: null }),
}));
