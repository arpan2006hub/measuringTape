/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GPSLocation } from '../types/issue';

/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the Haversine formula.
 *
 * @param loc1 First geographical coordinate
 * @param loc2 Second geographical coordinate
 * @returns Distance in meters
 */
export function calculateDistance(loc1: GPSLocation, loc2: GPSLocation): number {
  const EARTH_RADIUS_METERS = 6371000; // Radius of the Earth in meters

  const lat1Rad = (loc1.latitude * Math.PI) / 180;
  const lat2Rad = (loc2.latitude * Math.PI) / 180;
  const deltaLatRad = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
  const deltaLonRad = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;

  // Haversine formula
  const a =
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLonRad / 2) *
      Math.sin(deltaLonRad / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Validates whether a coordinate represents a duplicate issue of an existing one.
 * Triggered if the category is identical and distance is under the specified limit.
 *
 * @param loc1 Coordinates of issue 1
 * @param loc2 Coordinates of issue 2
 * @param thresholdMeters Maximum distance to consider as a duplicate (default: 100m)
 * @returns boolean
 */
export function isDuplicateLocation(
  loc1: GPSLocation,
  loc2: GPSLocation,
  thresholdMeters = 100
): boolean {
  return calculateDistance(loc1, loc2) <= thresholdMeters;
}
