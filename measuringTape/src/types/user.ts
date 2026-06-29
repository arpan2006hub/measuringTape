/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReputationProfile } from './reputation';
import { Locality } from './locality';

/**
 * Roles defining user capabilities within the system.
 */
export enum UserRole {
  CITIZEN = 'CITIZEN',
  AUTHORITY = 'AUTHORITY',
}

/**
 * Detailed profile of a registered user.
 * Citizens have locality subscriptions and reputation scores.
 * Authorities have credential metadata.
 */
export interface UserProfile {
  address: string; // The user's public Ethereum address (or platform-managed identifier)
  username: string; // User's preferred username or department name
  role: UserRole; // Security role
  subscribedLocalities: Locality[]; // List of locality objects subscribed to (geocoded)
  reputation: ReputationProfile; // The reputation and voting weight tracking
  createdAt: string; // ISO timestamp of registration
  updatedAt: string; // ISO timestamp of profile updates
}
