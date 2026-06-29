/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GPSLocation } from '../types/issue';

const BASE32_ALPHABET = '0123456789bcdefghjkmnpqrstuvwxyz';
const BITS = [16, 8, 4, 2, 1];

/**
 * Encodes latitude and longitude coordinates into a standard Geohash string.
 *
 * @param location GPS location (latitude and longitude)
 * @param precision Length of geohash string (default: 9, approx 4.77m x 4.77m)
 * @returns Standard Base32 Geohash string
 */
export function encodeGeohash(location: GPSLocation, precision = 9): string {
  const { latitude, longitude } = location;

  let latMin = -90.0;
  let latMax = 90.0;
  let lonMin = -180.0;
  let lonMax = 180.0;

  let geohash = '';
  let bit = 0;
  let ch = 0;
  let isEven = true;

  while (geohash.length < precision) {
    if (isEven) {
      const lonMid = (lonMin + lonMax) / 2;
      if (longitude > lonMid) {
        ch |= BITS[bit];
        lonMin = lonMid;
      } else {
        lonMax = lonMid;
      }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (latitude > latMid) {
        ch |= BITS[bit];
        latMin = latMid;
      } else {
        latMax = latMid;
      }
    }

    isEven = !isEven;

    if (bit < 4) {
      bit++;
    } else {
      geohash += BASE32_ALPHABET[ch];
      bit = 0;
      ch = 0;
    }
  }

  return geohash;
}

/**
 * Decodes a Geohash string back into geographical coordinates.
 * Returns the centroid coordinates of the bounding box and the bounds themselves.
 *
 * @param geohash Geohash string
 * @returns Centroid GPS coordinates and bounds
 */
export function decodeGeohash(geohash: string): {
  location: GPSLocation;
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
} {
  let isEven = true;
  let latMin = -90.0;
  let latMax = 90.0;
  let lonMin = -180.0;
  let lonMax = 180.0;

  const cleanGeohash = geohash.toLowerCase().trim();

  for (let i = 0; i < cleanGeohash.length; i++) {
    const char = cleanGeohash[i];
    const charIdx = BASE32_ALPHABET.indexOf(char);

    if (charIdx === -1) {
      throw new Error(`Invalid Geohash character detected: ${char}`);
    }

    for (let bitIdx = 0; bitIdx < 5; bitIdx++) {
      const mask = BITS[bitIdx];
      if (isEven) {
        const lonMid = (lonMin + lonMax) / 2;
        if ((charIdx & mask) !== 0) {
          lonMin = lonMid;
        } else {
          lonMax = lonMid;
        }
      } else {
        const latMid = (latMin + latMax) / 2;
        if ((charIdx & mask) !== 0) {
          latMin = latMid;
        } else {
          latMax = latMid;
        }
      }
      isEven = !isEven;
    }
  }

  const latitude = (latMin + latMax) / 2;
  const longitude = (lonMin + lonMax) / 2;

  return {
    location: { latitude, longitude },
    bounds: {
      minLat: latMin,
      maxLat: latMax,
      minLon: lonMin,
      maxLon: lonMax,
    },
  };
}
