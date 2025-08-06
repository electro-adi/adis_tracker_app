import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { MapPin, Satellite, RadioTower, Navigation as NavigationIcon } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LocationTab = () => {
  const [locationData, setLocationData] = useState({
    gps_lat: 49.9180204,
    gps_lon: 19.937429,
    lbs_lat: 49.9208907,
    lbs_lon: 19.9448864,
    sats: 0,
    lbs_age: "0 seconds",
    gps_age: "0 seconds",
    alt: 0.0,
    speed: 0.0,
    course: 0.0
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const requestLocation = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API}/device/location`);
      if (response.ok) {
        const data = await response.json();
        if (data.lat && data.lon) {
          setLocationData(data);
          toast({
            title: "Location Updated",
            description: "GPS coordinates have been refreshed successfully.",
          });
        }
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
    const url = `https://www.google.com/maps?q=${locationData.lat},${locationData.lon}`;
    window.open(url, '_blank');
  };

  /*// Load initial location data
  useEffect(() => {
    const loadInitialLocation = async () => {
      try {
        const response = await fetch(`${API}/device/location`);
        if (response.ok) {
          const data = await response.json();
          if (data.lat && data.lon) {
            setLocationData(data);
          }
        }
      } catch (error) {
        console.error('Failed to load initial location:', error);
      }
    };

    loadInitialLocation();
  }, []);*/

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Tracker Location</h1>
        <Button 
          onClick={requestLocation} 
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Updating...
            </>
          ) : (
            <>
              <MapPin className="w-4 h-4 mr-2" />
              Request Location
            </>
          )}
        </Button>
      </div>

      {/* Map Container */}
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-0">
          <div className="h-96 bg-gray-700 rounded-lg relative overflow-hidden">
            <MapContainer
              center={[locationData.lat, locationData.lon]}
              zoom={15}
              style={{ height: '100%', width: '100%' }}
              className="rounded-lg"
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <Marker position={[locationData.gps_lat, locationData.gps_lon]}>
                <Popup>
                  <div className="text-center">
                    <strong>GPS Tracker Location</strong><br />
                    Lat: {locationData.gps_lat}<br />
                    Lon: {locationData.gps_lon}<br />
                    Satellites: {locationData.sats}<br />
                    Speed: {locationData.speed} km/h
                  </div>
                </Popup>
              </Marker>
              <Marker position={[locationData.lbs_lat, locationData.lbs_lon]}>
                <Popup>
                  <div className="text-center">
                    <strong>GPS Tracker Location</strong><br />
                    Lat: {locationData.lbs_lat}<br />
                    Lon: {locationData.lbs_lon}<br />
                    Age: {locationData.lbs_age}<br />
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
              <span className="text-white font-mono">{locationData.lat}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Longitude:</span>
              <span className="text-white font-mono">{locationData.lon}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Satellites:</span>
              <span className="text-white">{locationData.sats}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Altitude:</span>
              <span className="text-white">{locationData.alt}m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Speed:</span>
              <span className="text-white">{locationData.speed} km/h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Course:</span>
              <span className="text-white">{locationData.course}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Data Age:</span>
              <span className="text-white">{locationData.gps_age}</span>
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
              <span className="text-white">{locationData.lbs_age}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LocationTab;