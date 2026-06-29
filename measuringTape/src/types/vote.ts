/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Ballot options for verifying whether a reported issue is genuine.
 */
export enum VerificationChoice {
  EXISTS = 'EXISTS',
  DOES_NOT_EXIST = 'DOES_NOT_EXIST',
}

/**
 * Ballot options for verifying whether a reported issue is resolved.
 */
export enum ResolutionChoice {
  RESOLVED = 'RESOLVED',
  NOT_RESOLVED = 'NOT_RESOLVED',
}

/**
 * Verification votes cast by citizens to confirm an issue exists.
 */
export interface VerificationVote {
  id: string; // Unique vote identifier
  issueId: string; // ID of the issue being verified
  voterAddress: string; // Public address of the citizen voting
  choice: VerificationChoice; // Choice: EXISTS or DOES_NOT_EXIST
  reputationWeight: number; // Voting weight of the citizen at the time of voting
  timestamp: string; // ISO timestamp when the vote was submitted
  blockchainTxHash?: string; // Optional blockchain transaction hash
}

/**
 * Resolution votes cast by citizens to verify a resolution submitted by an authority.
 */
export interface ResolutionVote {
  id: string; // Unique vote identifier
  issueId: string; // ID of the issue under resolution audit
  voterAddress: string; // Public address of the citizen auditing the resolution
  choice: ResolutionChoice; // Choice: RESOLVED or NOT_RESOLVED
  reputationWeight: number; // Voting weight of the citizen at the time of voting
  timestamp: string; // ISO timestamp when the vote was submitted
  blockchainTxHash?: string; // Optional blockchain transaction hash
}
