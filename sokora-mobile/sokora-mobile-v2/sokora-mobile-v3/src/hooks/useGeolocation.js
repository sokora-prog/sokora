/**
 * useGeolocation — Hook SOKORA
 * Récupère la position GPS du client/artisan avec expo-location.
 */
import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

export function useGeolocation({ autoRequest = true } = {}) {
  const [coords, setCoords]       = useState(null);  // { latitude, longitude }
  const [error, setError]         = useState(null);
  const [loading, setLoading]     = useState(false);
  const [permission, setPermission] = useState(null);

  const requestLocation = async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermission(status);
      if (status !== 'granted') {
        setError('Permission GPS refusée');
        return null;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setCoords(c);
      return c;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoRequest) requestLocation();
  }, []);

  return { coords, error, loading, permission, requestLocation };
}

export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = d => (d * Math.PI) / 180;
  const dlat = toRad(lat2 - lat1);
  const dlon = toRad(lon2 - lon1);
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dlon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

export function formatDistance(km) {
  if (!km && km !== 0) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
