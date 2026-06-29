/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Supported categories of civic issues.
 * These are mapped directly to standard infrastructure defects.
 */
export enum IssueCategory {
  POTHOLE = 'POTHOLE',
  WATER_LEAKAGE = 'WATER_LEAKAGE',
  GARBAGE_DUMP = 'GARBAGE_DUMP',
  BROKEN_STREETLIGHT = 'BROKEN_STREETLIGHT',
  DAMAGED_ROAD = 'DAMAGED_ROAD',
  OTHER = 'OTHER',
}

/**
 * State machine representing the lifecyle of a reported issue.
 */
export enum IssueStatus {
  REPORTED = 'REPORTED',
  VERIFIED = 'VERIFIED',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

/**
 * Standard representation of geographical coordinates.
 */
export interface GPSLocation {
  latitude: number;
  longitude: number;
}

/**
 * Details uploaded during resolution of an issue by the authority.
 */
export interface ResolutionDetails {
  notes: string;
  imageCid: string; // Pinata IPFS CID of the resolution proof image
  resolvedAt: string; // ISO timestamp
  resolverAddress: string; // Blockchain address of the resolving authority
}

/**
 * Core Issue interface representing both local cache details
 * and mapped smart-contract attributes.
 */
export interface Issue {
  id: string; // Unique identifier (typically a stringified uint256 from contract or UUID)
  title: string; // Display title of the issue
  description: string; // Detailed description of the infrastructure defect
  category: IssueCategory; // Category classification
  locality: string; // Subscribed ward or region identifier (e.g. "Ward A")
  location: GPSLocation; // Precise physical location (stored in IPFS metadata)
  imageCid: string; // Pinata IPFS CID for the reported evidence image
  reporterAddress: string; // Wallet address of the reporting user
  status: IssueStatus; // Current lifecycle status
  metadataCid: string; // IPFS hash containing the full immutable metadata JSON
  resolutionCid?: string; // IPFS hash for proof of resolution if status >= RESOLVED
  supportCount: number; // Support/upvote count for duplicate prevention & prioritization
  reputationPoints: number; // Aggregate reputation weight applied to this issue
  createdAt: string; // ISO timestamp of initial report
  updatedAt: string; // ISO timestamp of last modification
  assignedTo?: string; // Address of authority/department assigned to fix the issue
  resolution?: ResolutionDetails; // Resolution proof when status is RESOLVED or CLOSED
  blockchainTxHash?: string; // Transaction hash for contract registration
}

/**
 * Validated local draft of a reported issue in Zustand before publishing.
 */
export interface IssueDraft {
  id: string; // Draft ID (e.g., draft_123456789)
  title: string;
  description: string;
  category: IssueCategory;
  locality: string;
  location: GPSLocation;
  localImagePreview?: string; // Data URL or object URL of the uploaded image
  reporterAddress: string;
  createdAt: string;
  metadataCid?: string; // Pinned metadata hash from Pinata
  imageCid?: string; // Pinned image hash from Pinata
  blockchainTxHash?: string; // On-chain transaction hash for compilation
  onChainId?: number; // Unique ID assigned on-chain by nextIssueId
}

