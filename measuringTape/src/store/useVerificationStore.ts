/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { VerificationVote, VerificationChoice, ResolutionVote, ResolutionChoice } from '../types/vote';
import { 
  calculateVerificationConsensus, 
  calculateResolutionConsensus,
  auditVerificationVoters,
  auditResolutionVoters
} from '../utils/consensus';
import { useIssueStore } from './useIssueStore';
import { useUserStore } from './useUserStore';
import { IssueStatus } from '../types/issue';

interface VerificationState {
  verificationVotes: Record<string, VerificationVote[]>; // Grouped by issueId
  resolutionVotes: Record<string, ResolutionVote[]>; // Grouped by issueId
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchVotesForIssue: (issueId: string) => Promise<void>;
  submitVerificationVote: (
    voteData: Omit<VerificationVote, 'id' | 'timestamp'>
  ) => Promise<void>;
  submitResolutionVote: (
    voteData: Omit<ResolutionVote, 'id' | 'timestamp'>
  ) => Promise<void>;
  clearError: () => void;
}

/**
 * State store for community audits, including verification casting, resolution audits, and consensus polling.
 */
export const useVerificationStore = create<VerificationState>((set, get) => ({
  verificationVotes: {},
  resolutionVotes: {},
  isLoading: false,
  error: null,

  fetchVotesForIssue: async (issueId: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`/api/db/votes/${issueId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch votes');
      }
      const data = await res.json();
      const allVotes = data.votes as Array<{
        id: string;
        issueId: string;
        voterAddress: string;
        type: 'VERIFICATION' | 'RESOLUTION';
        choice: string;
        reputationWeight: number;
        timestamp: string;
      }>;

      const vVotes = allVotes
        .filter((v) => v.type === 'VERIFICATION')
        .map((v) => ({
          id: v.id,
          issueId: v.issueId,
          voterAddress: v.voterAddress,
          choice: v.choice as VerificationChoice,
          reputationWeight: v.reputationWeight,
          timestamp: v.timestamp,
        }));

      const rVotes = allVotes
        .filter((v) => v.type === 'RESOLUTION')
        .map((v) => ({
          id: v.id,
          issueId: v.issueId,
          voterAddress: v.voterAddress,
          choice: v.choice as ResolutionChoice,
          reputationWeight: v.reputationWeight,
          timestamp: v.timestamp,
        }));

      set((state) => ({
        verificationVotes: {
          ...state.verificationVotes,
          [issueId]: vVotes,
        },
        resolutionVotes: {
          ...state.resolutionVotes,
          [issueId]: rVotes,
        },
        isLoading: false,
      }));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch votes';
      set({ error: errorMessage, isLoading: false });
    }
  },

  submitVerificationVote: async (voteData) => {
    set({ isLoading: true, error: null });
    try {
      const issueId = voteData.issueId;

      // Persist to database
      const res = await fetch('/api/db/issues/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId,
          voterAddress: voteData.voterAddress,
          type: 'VERIFICATION',
          choice: voteData.choice,
          reputationWeight: voteData.reputationWeight,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to submit vote');
      }

      // Also call blockchain simulation
      const numericOnChainId = Number(issueId.replace('issue_', ''));
      if (!isNaN(numericOnChainId)) {
        try {
          await fetch('/api/blockchain/verify-issue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              issueId: numericOnChainId,
              verifierAddress: voteData.voterAddress,
              accepted: voteData.choice === VerificationChoice.EXISTS,
            }),
          });
        } catch (bcErr) {
          console.warn('[Blockchain API] Error during verify-issue flow, using local DB:', bcErr);
        }
      }

      // Refresh votes
      await get().fetchVotesForIssue(issueId);

      // Evaluate consensus
      const updatedVotes = get().verificationVotes[issueId] || [];
      const consensus = calculateVerificationConsensus(updatedVotes);
      if (consensus.isResolved && consensus.decision) {
        const newStatus = consensus.decision === VerificationChoice.EXISTS 
          ? IssueStatus.VERIFIED 
          : IssueStatus.CLOSED;

        // Update issue status locally & on server
        await useIssueStore.getState().updateIssueStatusLocal(issueId, newStatus, {
          reputationPoints: consensus.totalWeightedVotes,
        });

        // Perform reputation updates
        const reputationUpdates = auditVerificationVoters(updatedVotes, consensus.decision);
        const userStore = useUserStore.getState();
        const activeAddress = userStore.currentUser?.address;

        await Promise.all(
          reputationUpdates.map(async (update) => {
            try {
              await fetch('/api/auth/update-reputation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  address: update.address,
                  reputationPoints: update.adjustment,
                }),
              });

              if (activeAddress && update.address.toLowerCase() === activeAddress.toLowerCase()) {
                userStore.updateReputation(update.adjustment);
              }
            } catch (err) {
              console.error(`[Verification Store] Failed to update reputation for ${update.address}:`, err);
            }
          })
        );
      }
      set({ isLoading: false });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit vote';
      set({ error: errorMessage, isLoading: false });
      throw err;
    }
  },

  submitResolutionVote: async (voteData) => {
    set({ isLoading: true, error: null });
    try {
      const issueId = voteData.issueId;

      // Persist to database
      const res = await fetch('/api/db/issues/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId,
          voterAddress: voteData.voterAddress,
          type: 'RESOLUTION',
          choice: voteData.choice,
          reputationWeight: voteData.reputationWeight,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to submit resolution vote');
      }

      // Also call blockchain simulation
      const numericOnChainId = Number(issueId.replace('issue_', ''));
      if (!isNaN(numericOnChainId)) {
        try {
          await fetch('/api/blockchain/verify-resolution', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              issueId: numericOnChainId,
              verifierAddress: voteData.voterAddress,
              resolved: voteData.choice === ResolutionChoice.RESOLVED,
            }),
          });
        } catch (bcErr) {
          console.warn('[Blockchain API] Error during verify-resolution flow, using local DB:', bcErr);
        }
      }

      // Refresh votes
      await get().fetchVotesForIssue(issueId);

      // Evaluate consensus
      const updatedVotes = get().resolutionVotes[issueId] || [];
      const consensus = calculateResolutionConsensus(updatedVotes);
      if (consensus.isResolved && consensus.decision) {
        const newStatus = consensus.decision === ResolutionChoice.RESOLVED 
          ? IssueStatus.CLOSED 
          : IssueStatus.IN_PROGRESS;

        // Update issue status locally & on server
        await useIssueStore.getState().updateIssueStatusLocal(issueId, newStatus, {
          reputationPoints: (useIssueStore.getState().issues[issueId]?.reputationPoints || 0) + consensus.totalWeightedVotes,
        });

        // Perform reputation updates
        const reputationUpdates = auditResolutionVoters(updatedVotes, consensus.decision);
        const userStore = useUserStore.getState();
        const activeAddress = userStore.currentUser?.address;

        await Promise.all(
          reputationUpdates.map(async (update) => {
            try {
              await fetch('/api/auth/update-reputation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  address: update.address,
                  reputationPoints: update.adjustment,
                }),
              });

              if (activeAddress && update.address.toLowerCase() === activeAddress.toLowerCase()) {
                userStore.updateReputation(update.adjustment);
              }
            } catch (err) {
              console.error(`[Verification Store] Failed to update reputation for ${update.address}:`, err);
            }
          })
        );
      }
      set({ isLoading: false });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit resolution vote';
      set({ error: errorMessage, isLoading: false });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
