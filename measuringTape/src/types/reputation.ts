/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Reputation details for a user.
 * Tracks correct and incorrect consensus alignment on verification and resolution votes.
 */
export interface ReputationProfile {
  address: string; // Citizen's public wallet address
  score: number; // Raw reputation score, defaults to 0 (can be positive or negative)
  votingWeight: number; // Computed voting weight: max(1, floor(score / 20))
  correctVerifications: number; // Number of verification votes that aligned with consensus (+5 score)
  correctResolutions: number; // Number of resolution votes that aligned with consensus (+10 score)
  incorrectVerifications: number; // Number of verification votes against consensus (-3 score)
  failedChallenges: number; // Number of failed challenges or malicious actions (-5 score)
  lastUpdated: string; // ISO timestamp of the last reputation state change
}
