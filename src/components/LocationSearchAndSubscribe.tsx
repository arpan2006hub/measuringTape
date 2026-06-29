/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Check, Plus } from 'lucide-react';
import { Locality } from '@/measuringTape/src/types/locality';

const pinIcon = L.divIcon({
  html: `
    <div class="relative -top-8 -left-4">
      <div class="w-8 h-8 rounded-full bg-blue-600 border-2 border-white shadow-md flex items-center justify-center animate-bounce">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-white">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
      <div class="absolute top-8 left-3.5 w-1 h-3 bg-blue-600/30 rounded-full filter blur-[1px]"></div>
    </div>
  `,
  className: 'custom-pin-marker-blue',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

interface LocationSearchAndSubscribeProps {
  onSubscribe: (locality: Locality) => void;
  buttonText?: string;
  initialCenter?: { latitude: number; longitude: number };
}

function MapController({ center }: { center: { latitude: number; longitude: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.latitude, center.longitude], 14, { animate: true });
  }, [center, map]);
  return null;
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationSearchAndSubscribe({
  onSubscribe,
  buttonText = "Subscribe to Ward",
  initialCenter = { latitude: 12.9715987, longitude: 77.5945627 }, // Default center: Bengaluru
}: LocationSearchAndSubscribeProps) {
  const [selectedPos, setSelectedPos] = useState({ latitude: initialCenter.latitude, longitude: initialCenter.longitude });
  const [wardName, setWardName] = useState('My Custom Ward');
  const [radius, setRadius] = useState(1500); // meters

  // Geocoding helper to reverse-geocode map clicks
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `/api/reverse-geocode?lat=${lat}&lon=${lng}`
      );
      if (response.ok) {
        const data = await response.json();
        // Pick a shorter segment for ward name
        const addressParts = data.address || {};
        const shortName = addressParts.suburb || addressParts.neighbourhood || addressParts.road || addressParts.city || 'Custom Ward';
        setWardName(`${shortName} Ward`);
      }
    } catch (err) {
      console.error('Reverse geocode error:', err);
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    setSelectedPos({ latitude: lat, longitude: lng });
    reverseGeocode(lat, lng);
  };

  const handleSubscribeSubmit = () => {
    // Generate a deterministic locality ID based on name and coordinates to share issues smoothly across users subscribing to the same ward
    const normalizedName = wardName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
    const latCode = Math.round(selectedPos.latitude * 100);
    const lonCode = Math.round(selectedPos.longitude * 100);
    const id = `ward_${normalizedName}_${latCode}_${lonCode}`;

    const locality: Locality = {
      id,
      name: wardName,
      centerLocation: selectedPos,
      boundaryRadiusMeters: radius,
      activeIssueCount: 0,
      subscriberCount: 1,
      createdAt: new Date().toISOString(),
    };
    onSubscribe(locality);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Map Element */}
      <div className="relative w-full h-[280px] rounded-xl overflow-hidden border border-zinc-200 shadow-sm">
        <MapContainer
          center={[selectedPos.latitude, selectedPos.longitude]}
          zoom={14}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapController center={selectedPos} />
          <MapClickHandler onClick={handleMapClick} />
          <Marker position={[selectedPos.latitude, selectedPos.longitude]} icon={pinIcon} />
        </MapContainer>

        <div className="absolute top-3 left-3 z-10 px-3 py-1.5 bg-zinc-900/80 backdrop-blur-sm rounded-lg pointer-events-none">
          <p className="text-[10px] font-medium text-white flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-blue-400" /> Click anywhere on map to position ward center
          </p>
        </div>
      </div>

      {/* Subscription Configure Card */}
      <div className="bg-zinc-50 border border-zinc-200/60 p-4 rounded-xl flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3 w-full">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Ward Name</label>
            <input
              type="text"
              value={wardName}
              onChange={(e) => setWardName(e.target.value)}
              className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. My Ward"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Radius (meters)</label>
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value={500}>500m</option>
              <option value={1000}>1.0 km</option>
              <option value={1500}>1.5 km</option>
              <option value={2000}>2.0 km</option>
              <option value={3000}>3.0 km</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubscribeSubmit}
          className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> {buttonText}
        </button>
      </div>
    </div>
  );
}
