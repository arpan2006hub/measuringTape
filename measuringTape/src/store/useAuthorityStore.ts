/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { AuthorityAction } from '../types/authority';
import { IssueStatus } from '../types/issue';
import { useIssueStore } from './useIssueStore';

interface AuthorityState {
  actions: Record<string, AuthorityAction[]>; // Logged status transitions grouped by issueId
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchActionsForIssue: (issueId: string) => Promise<void>;
  assignIssue: (
    issueId: string,
    assignedTo: string,
    authorityAddress: string,
    notes: string
  ) => Promise<void>;
  startWork: (issueId: string, authorityAddress: string, notes: string) => Promise<void>;
  submitResolution: (
    issueId: string,
    imageCid: string,
    notes: string,
    authorityAddress: string
  ) => Promise<void>;
  clearError: () => void;
}

/**
 * State store for municipal authorities. Handles assignment logs, work progress transitions,
 * and resolution uploads. Integrates with useIssueStore to sync state changes.
 */
export const useAuthorityStore = create<AuthorityState>((set, get) => ({
  actions: {},
  isLoading: false,
  error: null,

  fetchActionsForIssue: async (issueId: string) => {
    set({ isLoading: true, error: null });
    try {
      // Simulate database audit trail fetch
      const mockActions: AuthorityAction[] = [
        {
          id: 'action_01',
          issueId,
          authorityAddress: '0xMunicipalAdminAddress',
          statusTransition: {
            from: IssueStatus.REPORTED,
            to: IssueStatus.VERIFIED,
          },
          notes: 'Civic verification completed successfully via automated vote calculations.',
          timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
        },
      ];

      set((state) => ({
        actions: {
          ...state.actions,
          [issueId]: mockActions,
        },
        isLoading: false,
      }));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch actions';
      set({ error: errorMessage, isLoading: false });
    }
  },

  assignIssue: async (issueId, assignedTo, authorityAddress, notes) => {
    set({ isLoading: true, error: null });
    try {
      const newAction: AuthorityAction = {
        id: `act_${Date.now()}`,
        issueId,
        authorityAddress,
        statusTransition: {
          from: IssueStatus.VERIFIED,
          to: IssueStatus.ASSIGNED,
        },
        notes: `Assigned to: ${assignedTo}. ${notes}`,
        timestamp: new Date().toISOString(),
      };

      // Push update to the issue cache
      const issueStore = useIssueStore.getState();
      issueStore.updateIssueStatusLocal(issueId, IssueStatus.ASSIGNED);

      // Mutate local issue record to set assigned address
      set((state) => {
        const currentActions = state.actions[issueId] || [];
        return {
          actions: {
            ...state.actions,
            [issueId]: [...currentActions, newAction],
          },
          isLoading: false,
        };
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Assignment failed';
      set({ error: errorMessage, isLoading: false });
      throw err;
    }
  },

  startWork: async (issueId, authorityAddress, notes) => {
    set({ isLoading: true, error: null });
    try {
      const newAction: AuthorityAction = {
        id: `act_${Date.now()}`,
        issueId,
        authorityAddress,
        statusTransition: {
          from: IssueStatus.ASSIGNED,
          to: IssueStatus.IN_PROGRESS,
        },
        notes,
        timestamp: new Date().toISOString(),
      };

      const issueStore = useIssueStore.getState();
      issueStore.updateIssueStatusLocal(issueId, IssueStatus.IN_PROGRESS);

      set((state) => {
        const currentActions = state.actions[issueId] || [];
        return {
          actions: {
            ...state.actions,
            [issueId]: [...currentActions, newAction],
          },
          isLoading: false,
        };
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start work';
      set({ error: errorMessage, isLoading: false });
      throw err;
    }
  },

  submitResolution: async (issueId, imageCid, notes, authorityAddress) => {
    set({ isLoading: true, error: null });
    try {
      const newAction: AuthorityAction = {
        id: `act_${Date.now()}`,
        issueId,
        authorityAddress,
        statusTransition: {
          from: IssueStatus.IN_PROGRESS,
          to: IssueStatus.RESOLVED,
        },
        notes: `Resolution proofs submitted. Notes: ${notes}`,
        evidenceCid: imageCid,
        timestamp: new Date().toISOString(),
      };

      const issueStore = useIssueStore.getState();
      issueStore.updateIssueStatusLocal(issueId, IssueStatus.RESOLVED);

      set((state) => {
        const currentActions = state.actions[issueId] || [];
        return {
          actions: {
            ...state.actions,
            [issueId]: [...currentActions, newAction],
          },
          isLoading: false,
        };
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit resolution';
      set({ error: errorMessage, isLoading: false });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
