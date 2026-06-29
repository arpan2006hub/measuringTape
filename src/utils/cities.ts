/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { City as CSC_City, State as CSC_State } from 'country-state-city';

export interface City {
  name: string;
  state: string;
  latitude: number;
  longitude: number;
}

// Fetch raw cities of India (country code 'IN') from the country-state-city library
const rawCities = CSC_City.getCitiesOfCountry('IN') || [];

// Build a map of state ISO codes to full state names for India
const statesMap = new Map<string, string>();
const rawStates = CSC_State.getStatesOfCountry('IN') || [];
rawStates.forEach(s => {
  statesMap.set(s.isoCode, s.name);
});

// Map to our custom City structure and filter invalid values
export const CITIES: City[] = rawCities.map(c => {
  const stateName = statesMap.get(c.stateCode) || c.stateCode;
  return {
    name: c.name,
    state: stateName,
    latitude: parseFloat(c.latitude || '0') || 22.5726, // Fallback default latitude (Kolkata) if missing
    longitude: parseFloat(c.longitude || '0') || 88.3639 // Fallback default longitude (Kolkata) if missing
  };
}).filter(c => c.name && c.state);

