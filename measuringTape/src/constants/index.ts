/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IssueCategory, IssueStatus } from '../types/issue';
import { Locality } from '../types/locality';

/**
 * Standard issue categories for the application.
 */
export const ISSUE_CATEGORIES: IssueCategory[] = [
  IssueCategory.POTHOLE,
  IssueCategory.WATER_LEAKAGE,
  IssueCategory.GARBAGE_DUMP,
  IssueCategory.BROKEN_STREETLIGHT,
  IssueCategory.DAMAGED_ROAD,
  IssueCategory.OTHER,
];

/**
 * Ordered list representing the sequential lifecycle transitions of a civic issue.
 */
export const ISSUE_STATUS_LIFECYCLE: IssueStatus[] = [
  IssueStatus.REPORTED,
  IssueStatus.VERIFIED,
  IssueStatus.ASSIGNED,
  IssueStatus.IN_PROGRESS,
  IssueStatus.RESOLVED,
  IssueStatus.CLOSED,
];

/**
 * Consensus parameters for verifying reported issues.
 */
export const VERIFICATION_RULES = {
  MIN_VOTES_REQUIRED: 5, // Minimum cumulative votes to trigger consensus check
  CONSENSUS_THRESHOLD_PERCENT: 70, // Required agreement percent (e.g., 70% EXISTS)
  DUPLICATE_DISTANCE_LIMIT_METERS: 100, // Distance below which issues are treated as potential duplicates
};

/**
 * Consensus parameters for auditing resolution proofs.
 */
export const RESOLUTION_RULES = {
  MIN_VOTES_REQUIRED: 5, // Minimum cumulative votes to trigger consensus check
  CONSENSUS_THRESHOLD_PERCENT: 70, // Required agreement percent (e.g., 70% RESOLVED)
};

/**
 * Reputation adjustment matrices based on alignment with final consensus.
 */
export const REPUTATION_ADJUSTMENTS = {
  CORRECT_VERIFICATION: 5, // Citizen voted correctly on issue verification (+5)
  CORRECT_RESOLUTION: 10, // Citizen voted correctly on resolution verification (+10)
  INCORRECT_VERIFICATION: -3, // Citizen voted against final verification consensus (-3)
  FAILED_CHALLENGE: -5, // Malicious report or malicious action (-5)
  BASE_VOTING_WEIGHT: 1, // Default voting weight
  VOTING_WEIGHT_REPUTATION_STEP: 20, // Voting weight is: max(1, floor(reputation / 20))
};
