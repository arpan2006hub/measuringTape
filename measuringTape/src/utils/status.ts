/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IssueStatus } from '../types/issue';
import { ISSUE_STATUS_LIFECYCLE } from '../constants';

/**
 * Validates whether a state transition is permitted in the strict sequential lifecycle:
 * REPORTED -> VERIFIED -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> CLOSED
 *
 * @param current Current status of the issue
 * @param next Proposed next status
 * @returns boolean indicating if transition is valid
 */
export function isValidStatusTransition(current: IssueStatus, next: IssueStatus): boolean {
  const currentIndex = ISSUE_STATUS_LIFECYCLE.indexOf(current);
  const nextIndex = ISSUE_STATUS_LIFECYCLE.indexOf(next);

  if (currentIndex === -1 || nextIndex === -1) {
    return false;
  }

  // Strict sequential state-machine transition
  // Allowing either advancing to the immediate next state, or remaining in current state
  return nextIndex === currentIndex + 1 || nextIndex === currentIndex;
}

/**
 * Checks if citizens are currently allowed to submit verification votes for the issue.
 */
export function isEligibleForVerification(status: IssueStatus): boolean {
  return status === IssueStatus.REPORTED;
}

/**
 * Checks if the issue can be assigned to an authority/department.
 */
export function isEligibleForAssignment(status: IssueStatus): boolean {
  return status === IssueStatus.VERIFIED;
}

/**
 * Checks if the issue has been assigned and is ready for work to begin.
 */
export function isEligibleForProgress(status: IssueStatus): boolean {
  return status === IssueStatus.ASSIGNED;
}

/**
 * Checks if the issue is actively being worked on and could have a resolution submitted.
 */
export function isEligibleForResolution(status: IssueStatus): boolean {
  return status === IssueStatus.IN_PROGRESS;
}

/**
 * Checks if the issue is in a resolution audit state (waiting for citizen vote consensus).
 */
export function isUnderResolutionAudit(status: IssueStatus): boolean {
  return status === IssueStatus.RESOLVED;
}

/**
 * Returns a user-friendly color theme class or hex value key for UI status tags.
 * Follows a clean visual palette.
 */
export function getStatusStyle(status: IssueStatus): {
  bgClass: string;
  textClass: string;
  label: string;
} {
  switch (status) {
    case IssueStatus.REPORTED:
      return {
        bgClass: 'bg-amber-50 border-amber-200 text-amber-800',
        textClass: 'text-amber-800',
        label: 'Reported',
      };
    case IssueStatus.VERIFIED:
      return {
        bgClass: 'bg-blue-50 border-blue-200 text-blue-800',
        textClass: 'text-blue-800',
        label: 'Verified',
      };
    case IssueStatus.ASSIGNED:
      return {
        bgClass: 'bg-indigo-50 border-indigo-200 text-indigo-800',
        textClass: 'text-indigo-800',
        label: 'Assigned',
      };
    case IssueStatus.IN_PROGRESS:
      return {
        bgClass: 'bg-sky-50 border-sky-200 text-sky-800',
        textClass: 'text-sky-800',
        label: 'In Progress',
      };
    case IssueStatus.RESOLVED:
      return {
        bgClass: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        textClass: 'text-emerald-800',
        label: 'Resolved',
      };
    case IssueStatus.CLOSED:
      return {
        bgClass: 'bg-zinc-50 border-zinc-200 text-zinc-800',
        textClass: 'text-zinc-800',
        label: 'Closed',
      };
    default:
      return {
        bgClass: 'bg-gray-50 border-gray-200 text-gray-800',
        textClass: 'text-gray-800',
        label: 'Unknown',
      };
  }
}
