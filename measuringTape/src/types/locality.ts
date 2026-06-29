/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GPSLocation } from './issue';

/**
 * Representation of a municipal region, ward, or district.
 * Used for subscribing users and filtering relevant issues for verification.
 */
export interface Locality {
  id: string; // Locality unique identifier (e.g. "WARD_A")
  name: string; // Readable name (e.g. "Ward A - Downtown")
  centerLocation: GPSLocation; // Centroid of the locality for distance calculations
  boundaryRadiusMeters: number; // Geographical boundary radius
  activeIssueCount: number; // Current active unresolved issues in this locality
  subscriberCount: number; // Total citizens subscribed to verification feeds for this area
  createdAt: string; // ISO timestamp
}
