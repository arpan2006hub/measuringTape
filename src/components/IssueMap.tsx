/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { GPSLocation } from '@/measuringTape/src/types/issue';
import { MapPin, Navigation } from 'lucide-react';

// Custom HTML/SVG marker icon to bypass Leaflet bundler image asset issues.
// Features a bouncing modern red civic pinpoint.
const customMarkerIcon = L.divIcon({
  html: `
    <div class="relative -top-8 -left-4">
      <div class="w-8 h-8 rounded-full bg-rose-500 border-2 border-white shadow-md flex items-center justify-center animate-pulse">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-white">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
      <div class="absolute top-8 left-3.5 w-1 h-3 bg-rose-500/30 rounded-full filter blur-[1px]"></div>
    </div>
  `,
  className: 'custom-pin-marker',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

interface IssueMapProps {
  location: GPSLocation;
  onChange: (loc: GPSLocation) => void;
  localityCenter: GPSLocation;
}

// Sub-component to sync map view center when locality selection changes.
function MapViewCenter({ center }: { center: GPSLocation }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.latitude, center.longitude], 15, { animate: true });
  }, [center, map]);
  return null;
}

// Sub-component to capture map click events.
function MapClickHandler({ onClick }: { onClick: (loc: GPSLocation) => void }) {
  useMapEvents({
    click(e) {
      onClick({
        latitude: e.latlng.lat,
        longitude: e.latlng.lng,
      });
    },
  });
  return null;
}

export default function IssueMap({ location, onChange, localityCenter }: IssueMapProps) {
  const markerRef = useRef<L.Marker>(null);

  // Drag handler for marker
  const eventHandlers = React.useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latLng = marker.getLatLng();
          onChange({
            latitude: latLng.lat,
            longitude: latLng.lng,
          });
        }
      },
    }),
    [onChange]
  );

  return (
    <div className="relative w-full h-[320px] rounded-xl overflow-hidden border border-zinc-200 shadow-sm group">
      {/* Map Backdrop */}
      <MapContainer
        center={[location.latitude, location.longitude]}
        zoom={15}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Sync Center on Locality Change */}
        <MapViewCenter center={localityCenter} />

        {/* Map Click Handler */}
        <MapClickHandler onClick={onChange} />

        {/* Interactive Draggable Marker */}
        <Marker
          draggable={true}
          eventHandlers={eventHandlers}
          position={[location.latitude, location.longitude]}
          icon={customMarkerIcon}
          ref={markerRef}
        />
      </MapContainer>

      {/* Floating HUD controls for user experience */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/95 backdrop-blur-md border border-zinc-200 shadow-lg rounded-lg pointer-events-auto">
          <Navigation className="w-3.5 h-3.5 text-zinc-500 animate-spin" style={{ animationDuration: '3s' }} />
          <span className="font-mono text-[10px] font-semibold text-zinc-700">
            {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
          </span>
        </div>
      </div>

      {/* Instructions Overlay */}
      <div className="absolute top-3 left-3 z-10 px-3 py-1.5 bg-zinc-900/80 backdrop-blur-sm shadow-sm rounded-lg pointer-events-none">
        <p className="text-[10px] font-medium text-white flex items-center gap-1">
          <MapPin className="w-3 h-3 text-rose-400" /> Click map or drag pin to position issue
        </p>
      </div>
    </div>
  );
}
