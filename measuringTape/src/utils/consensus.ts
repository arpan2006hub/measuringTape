/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VerificationVote, VerificationChoice, ResolutionVote, ResolutionChoice } from '../types/vote';
import { VERIFICATION_RULES, RESOLUTION_RULES, REPUTATION_ADJUSTMENTS } from '../constants';

export interface ConsensusOutcome<T> {
  isResolved: boolean; // Has consensus threshold and voter count been achieved?
  decision?: T; // Winning selection (VerificationChoice or ResolutionChoice)
  agreementPercentage: number; // Percentage of weighted votes for the winning decision
  totalWeightedVotes: number; // Sum of weights of all votes
  totalRawVotesCount: number; // Real physical count of voters
}

export interface VoterReputationUpdate {
  address: string;
  adjustment: number;
}

/**
 * Calculates whether verification consensus has been achieved for a reported issue.
 * Matches: min 5 votes, 70% agreement. Weighted by each voter's reputation weight.
 *
 * @param votes Set of verification votes cast on the issue
 * @returns ConsensusOutcome<VerificationChoice>
 */
export function calculateVerificationConsensus(
  votes: VerificationVote[]
): ConsensusOutcome<VerificationChoice> {
  const totalVotesCount = votes.length;

  if (totalVotesCount < VERIFICATION_RULES.MIN_VOTES_REQUIRED) {
    return {
      isResolved: false,
      agreementPercentage: 0,
      totalWeightedVotes: 0,
      totalRawVotesCount: totalVotesCount,
    };
  }

  let weightedExists = 0;
  let weightedDoesNotExist = 0;

  for (let i = 0; i < totalVotesCount; i++) {
    const vote = votes[i];
    if (vote.choice === VerificationChoice.EXISTS) {
      weightedExists += vote.reputationWeight;
    } else {
      weightedDoesNotExist += vote.reputationWeight;
    }
  }

  const totalWeighted = weightedExists + weightedDoesNotExist;

  if (totalWeighted === 0) {
    return {
      isResolved: false,
      agreementPercentage: 0,
      totalWeightedVotes: 0,
      totalRawVotesCount: totalVotesCount,
    };
  }

  const existsRatio = (weightedExists / totalWeighted) * 100;
  const doesNotExistRatio = (weightedDoesNotExist / totalWeighted) * 100;

  const threshold = VERIFICATION_RULES.CONSENSUS_THRESHOLD_PERCENT;

  if (existsRatio >= threshold) {
    return {
      isResolved: true,
      decision: VerificationChoice.EXISTS,
      agreementPercentage: Math.round(existsRatio),
      totalWeightedVotes: totalWeighted,
      totalRawVotesCount: totalVotesCount,
    };
  }

  if (doesNotExistRatio >= threshold) {
    return {
      isResolved: true,
      decision: VerificationChoice.DOES_NOT_EXIST,
      agreementPercentage: Math.round(doesNotExistRatio),
      totalWeightedVotes: totalWeighted,
      totalRawVotesCount: totalVotesCount,
    };
  }

  // Active voting but no consensus reached yet
  return {
    isResolved: false,
    agreementPercentage: Math.max(Math.round(existsRatio), Math.round(doesNotExistRatio)),
    totalWeightedVotes: totalWeighted,
    totalRawVotesCount: totalVotesCount,
  };
}

/**
 * Calculates whether resolution verification consensus has been achieved.
 * Matches: min 5 votes, 70% agreement. Weighted by voter's reputation.
 *
 * @param votes Set of resolution votes cast on the issue
 * @returns ConsensusOutcome<ResolutionChoice>
 */
export function calculateResolutionConsensus(
  votes: ResolutionVote[]
): ConsensusOutcome<ResolutionChoice> {
  const totalVotesCount = votes.length;

  if (totalVotesCount < RESOLUTION_RULES.MIN_VOTES_REQUIRED) {
    return {
      isResolved: false,
      agreementPercentage: 0,
      totalWeightedVotes: 0,
      totalRawVotesCount: totalVotesCount,
    };
  }

  let weightedResolved = 0;
  let weightedNotResolved = 0;

  for (let i = 0; i < totalVotesCount; i++) {
    const vote = votes[i];
    if (vote.choice === ResolutionChoice.RESOLVED) {
      weightedResolved += vote.reputationWeight;
    } else {
      weightedNotResolved += vote.reputationWeight;
    }
  }

  const totalWeighted = weightedResolved + weightedNotResolved;

  if (totalWeighted === 0) {
    return {
      isResolved: false,
      agreementPercentage: 0,
      totalWeightedVotes: 0,
      totalRawVotesCount: totalVotesCount,
    };
  }

  const resolvedRatio = (weightedResolved / totalWeighted) * 100;
  const notResolvedRatio = (weightedNotResolved / totalWeighted) * 100;

  const threshold = RESOLUTION_RULES.CONSENSUS_THRESHOLD_PERCENT;

  if (resolvedRatio >= threshold) {
    return {
      isResolved: true,
      decision: ResolutionChoice.RESOLVED,
      agreementPercentage: Math.round(resolvedRatio),
      totalWeightedVotes: totalWeighted,
      totalRawVotesCount: totalVotesCount,
    };
  }

  if (notResolvedRatio >= threshold) {
    return {
      isResolved: true,
      decision: ResolutionChoice.NOT_RESOLVED,
      agreementPercentage: Math.round(notResolvedRatio),
      totalWeightedVotes: totalWeighted,
      totalRawVotesCount: totalVotesCount,
    };
  }

  return {
    isResolved: false,
    agreementPercentage: Math.max(Math.round(resolvedRatio), Math.round(notResolvedRatio)),
    totalWeightedVotes: totalWeighted,
    totalRawVotesCount: totalVotesCount,
  };
}

/**
 * Computes reputation score updates for voters when verification consensus is resolved.
 * Citizens aligned with final consensus gain +5, while those against lose -3.
 *
 * @param votes Set of verification votes
 * @param decision The final consensus decision reached
 * @returns Array of individual voter reputation modifications
 */
export function auditVerificationVoters(
  votes: VerificationVote[],
  decision: VerificationChoice
): VoterReputationUpdate[] {
  const updates: VoterReputationUpdate[] = [];

  for (let i = 0; i < votes.length; i++) {
    const vote = votes[i];
    const isAligned = vote.choice === decision;

    updates.push({
      address: vote.voterAddress,
      adjustment: isAligned
        ? REPUTATION_ADJUSTMENTS.CORRECT_VERIFICATION
        : REPUTATION_ADJUSTMENTS.INCORRECT_VERIFICATION,
    });
  }

  return updates;
}

/**
 * Computes reputation score updates for voters when resolution consensus is resolved.
 * Citizens aligned with final consensus gain +10, while those against lose -3.
 *
 * @param votes Set of resolution verification votes
 * @param decision The final consensus decision reached
 * @returns Array of individual voter reputation modifications
 */
export function auditResolutionVoters(
  votes: ResolutionVote[],
  decision: ResolutionChoice
): VoterReputationUpdate[] {
  const updates: VoterReputationUpdate[] = [];

  for (let i = 0; i < votes.length; i++) {
    const vote = votes[i];
    const isAligned = vote.choice === decision;

    updates.push({
      address: vote.voterAddress,
      adjustment: isAligned
        ? REPUTATION_ADJUSTMENTS.CORRECT_RESOLUTION
        : REPUTATION_ADJUSTMENTS.INCORRECT_VERIFICATION, // Uses standard voter misalignment penalty
    });
  }

  return updates;
}

/**
 * Helper to dynamically compute voting weight of a profile from its reputation score.
 * Formula: max(1, floor(reputation / 20))
 *
 * @param score Raw reputation score
 * @returns Computed voting weight
 */
export function getVotingWeight(score: number): number {
  const weight = Math.floor(score / REPUTATION_ADJUSTMENTS.VOTING_WEIGHT_REPUTATION_STEP);
  return Math.max(REPUTATION_ADJUSTMENTS.BASE_VOTING_WEIGHT, weight);
}
