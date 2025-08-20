import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { MapPin, Satellite, RadioTower, Navigation as NavigationIcon } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Colored marker icons
const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const FitBoundsToMarkers = ({ gps, lbs }) => {
  const map = useMap();
  const hasFit = React.useRef(false);

  useEffect(() => {
    if (!gps || !lbs) return;

    if (!hasFit.current) {
      const bounds = L.latLngBounds([gps, lbs]);
      map.fitBounds(bounds, { padding: [30, 30] });
      hasFit.current = true;
    }
  }, [gps, lbs, map]);

  return null;
};


const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LocationTab = () => {
  const [locationData, setLocationData] = useState({
    message: "Offline",
    gps_lat: 49.9180204,
    gps_lon: 19.937429,
    lbs_lat: 49.9208907,
    lbs_lon: 19.9448864,
    sats: 0,
    lbs_age: "--",
    gps_age: "--",
    alt: 0.0,
    speed: 0.0,
    course: 0.0
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadlocation();
  }, []);
  
  const loadlocation = async () => {
    try {
      const response = await fetch(`${API}/device/location_nomqtt`);
      if (response.ok) {
        const data = await response.json();
        hasFit.current = false;
        setLocationData(data);
      }
    } catch (error) {
      console.error('Failed to load location:', error);
    }
  };

  const requestLocation = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API}/device/location`);
      if (response.ok) {
        const data = await response.json();
        hasFit.current = false;
        setLocationData(data);
        toast({
          title: "Location Updated",
          description: "GPS coordinates have been refreshed successfully.",
        });
      } else {
        throw new Error('Failed to get location');
      }
    } catch (error) {
      console.error('Location request failed:', error);
      toast({
        title: "Error",
        description: "Failed to get location data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openInGoogleMaps = () => {
    const url = `https://www.google.com/maps?q=${locationData.gps_lat},${locationData.gps_lon}`;
    window.open(url, '_blank');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Tracker Location</h1>
        <Button
          onClick={requestLocation}
          disabled={loading}
          className={`
            relative group // For pseudo-elements if needed, and for grouping states
            bg-gradient-to-br from-sky-500 to-blue-600 // Softer gradient
            text-white font-semibold
            px-5 py-2.5 // Slightly more padding for a beefier feel
            rounded-lg
            overflow-hidden // Important for ::before/::after pseudo-elements if used for shimmer
            transition-all duration-300 ease-out // Smooth transitions for hover/active
            shadow-md hover:shadow-lg // Subtle shadow, more pronounced on hover
            focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-gray-950
            active:scale-95 active:shadow-inner // Scale down and inner shadow when pressed
            disabled:opacity-60 disabled:cursor-not-allowed
          `}
        >   
          <span className="relative z-10 flex items-center justify-center">
            {loading ? (
              <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Updating Location...
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 mr-2 group-hover:animate-pulse" /> {/* Pulse icon on hover */}
                Request Location
              </>
            )}
          </span>
        </Button>
      </div>

      {/* Map Container */}
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-0">
          <div className="h-96 bg-gray-700 rounded-lg relative overflow-hidden">
            <MapContainer
              center={[locationData.gps_lat, locationData.gps_lon]}
              zoom={15}
              style={{ height: '100%', width: '100%' }}
              className="rounded-lg"
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />

              {/* Auto fit to both markers */}
              <FitBoundsToMarkers
                gps={[locationData.gps_lat, locationData.gps_lon]}
                lbs={[locationData.lbs_lat, locationData.lbs_lon]}
              />

              {/* GPS Marker - Blue */}
              <Marker
                position={[locationData.gps_lat, locationData.gps_lon]}
                icon={blueIcon}
              >
                <Popup>
                  <div className="text-center">
                    <strong>GPS Location</strong><br />
                    Lat: {locationData.gps_lat}<br />
                    Lon: {locationData.gps_lon}<br />
                    Satellites: {locationData.sats ?? "--"}<br />
                    Speed: {locationData.speed ?? "--"} km/h
                    Age: {locationData.gps_age ?? "--"}<br />
                  </div>
                </Popup>
              </Marker>

              {/* LBS Marker - Green */}
              <Marker
                position={[locationData.lbs_lat, locationData.lbs_lon]}
                icon={greenIcon}
              >
                <Popup>
                  <div className="text-center">
                    <strong>LBS Location</strong><br />
                    Lat: {locationData.lbs_lat}<br />
                    Lon: {locationData.lbs_lon}<br />
                    Age: {locationData.lbs_age ?? "--"}<br />
                  </div>
                </Popup>
              </Marker>
            </MapContainer>

            {/* Overlay Controls */}
            <div className="absolute top-4 right-4 z-5">
              <Button
                onClick={openInGoogleMaps}
                size="sm"
                className="bg-gray-900/80 hover:bg-gray-900 text-white backdrop-blur-sm"
              >
                <NavigationIcon className="w-4 h-4 mr-2" />
                Open in Maps
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Location Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Satellite className="w-5 h-5 mr-2 text-blue-400" />
              GPS Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Latitude:</span>
              <span className="text-white font-mono">{locationData.gps_lat}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Longitude:</span>
              <span className="text-white font-mono">{locationData.gps_lon}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Satellites:</span>
              <span className="text-white">{locationData.sats ?? "--"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Altitude:</span>
              <span className="text-white">{locationData.alt ?? "--"}m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Speed:</span>
              <span className="text-white">{locationData.speed ?? "--"} km/h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Course:</span>
              <span className="text-white">{locationData.course ?? "--"}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Data Age:</span>
              <span className="text-white">{locationData.gps_age ?? "--"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <RadioTower className="w-5 h-5 mr-2 text-green-400" />
              LBS Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">LBS Latitude:</span>
              <span className="text-white font-mono">{locationData.lbs_lat}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">LBS Longitude:</span>
              <span className="text-white font-mono">{locationData.lbs_lon}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Data Age:</span>
              <span className="text-white">{locationData.lbs_age ?? "--"}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LocationTab;