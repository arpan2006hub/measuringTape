/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { Issue, IssueCategory, IssueStatus, GPSLocation, IssueDraft } from '../types/issue';
import { calculateDistance } from '../utils/haversine';

interface IssueState {
  issues: Record<string, Issue>;
  drafts: Record<string, IssueDraft>;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchIssues: () => Promise<void>;
  reportIssue: (
    issueData: Omit<
      Issue,
      | 'id'
      | 'status'
      | 'supportCount'
      | 'reputationPoints'
      | 'createdAt'
      | 'updatedAt'
      | 'metadataCid'
    >
  ) => Promise<string>;
  saveDraft: (
    draftData: Omit<IssueDraft, 'id' | 'createdAt'>
  ) => Promise<string>;
  deleteDraft: (draftId: string) => void;
  supportIssue: (issueId: string, citizenAddress: string) => Promise<void>;
  updateIssueStatusLocal: (issueId: string, status: IssueStatus, extra?: Partial<Issue>) => void;
  checkDuplicate: (category: IssueCategory, location: GPSLocation) => Issue | null;
  getIssuesByLocality: (localityId: string) => Issue[];
  clearError: () => void;
}

/**
 * State store for civic issues. Handles caching, duplicate queries, support mechanisms, and details fetching.
 */
export const useIssueStore = create<IssueState>((set, get) => ({
  issues: {},
  isLoading: false,
  error: null,

  fetchIssues: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/db/issues');
      if (res.ok) {
        const data = await res.json();
        const serverIssues: Issue[] = data.issues || [];
        
        const issuesMap = serverIssues.reduce<Record<string, Issue>>((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {});
        
        set({ issues: issuesMap, isLoading: false });
      } else {
        set({ issues: {}, isLoading: false });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch issues';
      set({ error: errorMessage, isLoading: false });
    }
  },

  reportIssue: async (issueData) => {
    set({ isLoading: true, error: null });
    try {
      const duplicate = get().checkDuplicate(issueData.category, issueData.location);
      if (duplicate) {
        throw new Error(`Duplicate issue found: "${duplicate.title}" is within 100m.`);
      }

      const generatedId = `issue_${Date.now()}`;
      const fakeMetadataCid = `QmMetadataHash_${Math.random().toString(36).substring(2)}`;

      const newIssue: Issue = {
        ...issueData,
        id: generatedId,
        status: IssueStatus.REPORTED,
        metadataCid: fakeMetadataCid,
        supportCount: 1, // Self-support by reporter
        reputationPoints: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Persist to local DB
      await fetch('/api/db/issues/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newIssue.title,
          description: newIssue.description,
          category: newIssue.category,
          locality: newIssue.locality,
          location: newIssue.location,
          imageCid: newIssue.imageCid,
          reporterAddress: newIssue.reporterAddress,
          status: 'REPORTED',
          metadataCid: newIssue.metadataCid,
        }),
      });

      await get().fetchIssues();
      return generatedId;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to report issue';
      set({ error: errorMessage, isLoading: false });
      throw err;
    }
  },

  supportIssue: async (issueId: string, citizenAddress: string) => {
    set({ isLoading: true, error: null });
    try {
      // Post support vote to server DB
      const res = await fetch('/api/db/issues/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId,
          voterAddress: citizenAddress,
          type: 'VERIFICATION',
          choice: 'EXISTS',
          reputationWeight: 1,
        }),
      });
      if (!res.ok) {
        throw new Error('Failed to persist support vote');
      }
      
      // Also notify blockchain simulation
      const numericOnChainId = Number(issueId.replace('issue_', ''));
      if (!isNaN(numericOnChainId)) {
        await fetch('/api/blockchain/support-issue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            issueId: numericOnChainId,
            supporterAddress: citizenAddress,
          }),
        });
      }

      await get().fetchIssues();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to support issue';
      set({ error: errorMessage, isLoading: false });
    }
  },

  updateIssueStatusLocal: (issueId: string, status: IssueStatus, extra?: Partial<Issue>) => {
    // Fire-and-forget server sync, update state synchronously for snappy UI response
    fetch('/api/db/issues/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: issueId,
        status,
        ...extra,
      }),
    })
      .then(() => get().fetchIssues())
      .catch((err) => console.error('Failed to sync issue update to server:', err));

    set((state) => {
      const issue = state.issues[issueId];
      if (!issue) return {};

      const updatedIssue: Issue = {
        ...issue,
        status,
        ...extra,
        updatedAt: new Date().toISOString(),
      };

      return {
        issues: {
          ...state.issues,
          [issueId]: updatedIssue,
        },
      };
    });
  },

  checkDuplicate: (category: IssueCategory, location: GPSLocation): Issue | null => {
    const list = Object.values(get().issues);
    for (let i = 0; i < list.length; i++) {
      const issue = list[i];
      if (issue.category === category && issue.status !== IssueStatus.CLOSED) {
        const distance = calculateDistance(location, issue.location);
        if (distance <= 100) {
          return issue;
        }
      }
    }
    return null;
  },

  getIssuesByLocality: (localityId: string): Issue[] => {
    return Object.values(get().issues).filter((issue) => issue.locality === localityId);
  },

  drafts: {},

  saveDraft: async (draftData) => {
    set({ isLoading: true, error: null });
    try {
      const draftId = `draft_${Date.now()}`;
      const newDraft: IssueDraft = {
        ...draftData,
        id: draftId,
        createdAt: new Date().toISOString(),
      };

      // Persist to server DB if it is reported (fully ready draft with onChainId / metadataCid)
      if (newDraft.metadataCid && newDraft.onChainId !== undefined) {
        try {
          await fetch('/api/db/issues/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: newDraft.title,
              description: newDraft.description,
              category: newDraft.category,
              locality: newDraft.locality,
              location: newDraft.location,
              imageCid: newDraft.imageCid,
              reporterAddress: newDraft.reporterAddress,
              status: 'REPORTED',
              metadataCid: newDraft.metadataCid,
              blockchainTxHash: newDraft.blockchainTxHash,
              onChainId: newDraft.onChainId,
            }),
          });
        } catch (dbErr) {
          console.error('Failed to persist issue to server DB:', dbErr);
        }
      }

      set((state) => ({
        drafts: {
          ...state.drafts,
          [draftId]: newDraft,
        },
        isLoading: false,
      }));

      // Refresh list to instantly show reported issue
      await get().fetchIssues();

      return draftId;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save draft';
      set({ error: errorMessage, isLoading: false });
      throw err;
    }
  },

  deleteDraft: (draftId: string) => {
    set((state) => {
      const updatedDrafts = { ...state.drafts };
      delete updatedDrafts[draftId];
      return { drafts: updatedDrafts };
    });
  },

  clearError: () => set({ error: null }),
}));
