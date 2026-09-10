'use client';

import { useEffect, useRef } from 'react';
import type { LocationTripGroup } from '@/lib/delivery-parser';
import 'leaflet/dist/leaflet.css';

interface DeliveryLeafletMapProps {
  groups: LocationTripGroup[];
  selectedLocationId?: string | null;
  onSelectLocation?: (locationId: string) => void;
}

export default function DeliveryLeafletMap({
  groups,
  selectedLocationId,
  onSelectLocation,
}: DeliveryLeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let L: any;
    import('leaflet').then(leafletModule => {
      L = leafletModule.default || leafletModule;

      // Fix missing Leaflet default icon URLs in webpack/next
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (!mapInstanceRef.current) {
        // แม่ฮ่องสอน Center
        const centerLat = groups.length > 0 ? groups[0].lat : 19.3005;
        const centerLng = groups.length > 0 ? groups[0].lng : 97.9678;

        const map = L.map(mapContainerRef.current).setView([centerLat, centerLng], 14);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      // Clear previous markers
      markersRef.current.forEach(m => map.removeLayer(m));
      markersRef.current = [];

      // Add pins for each location group
      groups.forEach(group => {
        const isSelected = selectedLocationId === group.locationId;
        const allDone = group.pendingCount === 0 && group.items.length > 0;

        // Custom HTML marker showing total count badge
        const badgeColor = allDone ? '#10b981' : isSelected ? '#d97706' : '#f59e0b';
        const customIcon = L.divIcon({
          className: 'custom-map-marker',
          html: `
            <div style="
              background-color: ${badgeColor};
              color: white;
              border: 2px solid white;
              border-radius: 50%;
              width: 32px;
              height: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              font-size: 13px;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            ">
              ${group.items.length}
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${group.lat},${group.lng}`;

        const marker = L.marker([group.lat, group.lng], { icon: customIcon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: inherit; font-size: 13px; min-width: 180px;">
              <strong style="font-size: 14px; color: #1c1917;">${group.locationName}</strong>
              <div style="margin: 6px 0; color: #57534e;">
                จำนวนผู้รับ: <b>${group.items.length}</b> คน<br/>
                (ส่งแล้ว ${group.deliveredCount}, รอส่ง ${group.pendingCount})
              </div>
              <a href="${navUrl}" target="_blank" rel="noreferrer" style="
                display: inline-block;
                margin-top: 4px;
                padding: 4px 10px;
                background-color: #d97706;
                color: white;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                font-size: 11px;
              ">🚗 เปิด Google Maps นำทาง</a>
            </div>
          `);

        marker.on('click', () => {
          if (onSelectLocation) onSelectLocation(group.locationId);
        });

        markersRef.current.push(marker);
      });

      // Fit bounds if multiple locations exist
      if (groups.length > 1) {
        const bounds = L.latLngBounds(groups.map(g => [g.lat, g.lng]));
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    });

    return () => {
      // Keep map instance
    };
  }, [groups, selectedLocationId, onSelectLocation]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-[320px] sm:h-[420px] rounded-2xl overflow-hidden border border-stone-200/80 dark:border-stone-800 shadow-xs z-10 relative"
    />
  );
}
