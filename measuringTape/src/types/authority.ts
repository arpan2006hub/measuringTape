/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IssueStatus } from './issue';

/**
 * Audit log of actions performed by authorized service departments or administrators.
 */
export interface AuthorityAction {
  id: string; // Unique action ID
  issueId: string; // The ID of the issue the action was performed on
  authorityAddress: string; // Public wallet address of the authority/operator
  statusTransition: {
    from: IssueStatus;
    to: IssueStatus;
  }; // State machine transition
  notes: string; // Explanation, rationale, or proof description of the action
  evidenceCid?: string; // Optional IPFS hash pointing to additional documentation or images
  timestamp: string; // ISO timestamp when the action was logged
  blockchainTxHash?: string; // Optional blockchain transaction hash
}
