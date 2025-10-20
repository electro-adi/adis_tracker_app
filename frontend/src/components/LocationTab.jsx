import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { MapPin, Satellite, RadioTower, Navigation as NavigationIcon } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { ref, onValue, set } from "firebase/database";
import { db } from "../firebase";

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

const blueDotIcon = L.divIcon({
  className: "custom-blue-dot",
  html: '<div style="width:10px;height:10px;background:blue;border-radius:50%;border:2px solid white;"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const greenDotIcon = L.divIcon({
  className: "custom-green-dot",
  html: '<div style="width:10px;height:10px;background:green;border-radius:50%;border:2px solid white;"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const FitBoundsToMarkers = ({ gps, lbs, hasFit }) => {
  const map = useMap();

  useEffect(() => {
    if (!gps || !lbs) return;

    if (!hasFit.current) {
      const bounds = L.latLngBounds([gps, lbs]);
      map.fitBounds(bounds, { padding: [30, 30] });
      hasFit.current = true;
    }
  }, [gps, lbs, map, hasFit]);

  return null;
};

const LocationTab = () => {
  const hasFit = React.useRef(false); 

  const [locationData, setLocationData] = useState({
    send_reason: 0,
    gps_lat: 49.9180204,
    gps_lon: 19.937429,
    lbs_lat: 49.9208907,
    lbs_lon: 19.9448864,
    sats: 0,
    alt: 0.0,
    speed: 0.0,
    course: 0.0,
    gps_age_human: "--",
    lbs_age_human: "--",
  });

  const sendReasonMap = {
    0: "Boot",
    1: "Request",
    2: "Request (Sleep)",
    3: "Fix Found",
    4: "Fix Found (Sleep)",
    5: "Periodic Wakeup (Sleep)"
  };

  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState([]);

  const getTimeAgo = (isoString) => {
    if (!isoString) return '--';
    const now = new Date();
    const past = new Date(isoString);
    const diffMs = now - past;
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  };

  useEffect(() => {
    const locationRef = ref(db, 'Tracker/Location/latest');
    const unsubLocation = onValue(locationRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        hasFit.current = false;
        setLocationData({
          send_reason: data.send_reason || 0,
          gps_lat: data.gps_lat || 49.9180204,
          gps_lon: data.gps_lon || 19.937429,
          lbs_lat: data.lbs_lat || 49.9208907,
          lbs_lon: data.lbs_lon || 19.9448864,
          sats: data.sats || 0,
          alt: data.alt || 0.0,
          speed: data.speed || 0.0,
          course: data.course || 0.0,
          gps_age_human: getTimeAgo(data.gps_timestamp),
          lbs_age_human: getTimeAgo(data.lbs_timestamp),
        });
      }
    });

    const updateInterval = setInterval(() => {
      setLocationData(prev => ({
        ...prev,
        gps_age_human: getTimeAgo(prev.gps_timestamp),
        lbs_age_human: getTimeAgo(prev.lbs_timestamp),
      }));
    }, 30000);

    return () => {
      unsubLocation();
      clearInterval(updateInterval);
    };
  }, []);

  useEffect(() => {
    if (!showHistory) return;

    const historyRef = ref(db, 'Tracker/Location/history');
    const unsubHistory = onValue(historyRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const historyArray = Object.values(data)
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 50);
        setHistoryData(historyArray);
      }
    });

    return () => unsubHistory();
  }, [showHistory]);

  const requestLocation = async () => {
    setLoading(true);
    try {
      const commandRef = ref(db, 'Tracker/commands');
      await set(commandRef, {
        command: 'get_location',
        data1: ' ',
        data2: ' ',
        timestamp: new Date().toISOString(),
        pending: true
      });
      
      toast({
        title: "Location Updated",
        description: "Request sent for new location data.",
      });
    } catch (error) {
      console.error('Location request failed:', error);
      toast({
        title: "Error",
        description: "Failed to send location request.",
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
            relative group
            bg-gradient-to-br from-sky-500 to-blue-600
            text-white font-semibold
            px-5 py-2.5
            rounded-lg
            overflow-hidden
            transition-all duration-300 ease-out
            shadow-md hover:shadow-lg
            focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-gray-950
            active:scale-95 active:shadow-inner
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
                <MapPin className="w-4 h-4 mr-2 group-hover:animate-pulse" />
                Request Location
              </>
            )}
          </span>
        </Button>
      </div>

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

              <FitBoundsToMarkers
                gps={[locationData.gps_lat, locationData.gps_lon]}
                lbs={[locationData.lbs_lat, locationData.lbs_lon]}
                hasFit={hasFit} 
              />

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
                    Speed: {locationData.speed ?? "--"} km/h <br />
                    Age: {locationData.gps_age_human ?? "--"}<br />
                    Event: {sendReasonMap[locationData.send_reason] ?? "--"}<br />
                  </div>
                </Popup>
              </Marker>

              <Marker
                position={[locationData.lbs_lat, locationData.lbs_lon]}
                icon={greenIcon}
              >
                <Popup>
                  <div className="text-center">
                    <strong>LBS Location</strong><br />
                    Lat: {locationData.lbs_lat}<br />
                    Lon: {locationData.lbs_lon}<br />
                    Age: {locationData.lbs_age_human ?? "--"}<br />
                    Event: {sendReasonMap[locationData.send_reason] ?? "--"}<br />
                  </div>
                </Popup>
              </Marker>

              {showHistory && historyData.length > 0 && (
                <>
                  {historyData.map((point, idx) => (
                    <Marker
                      key={`gps-${idx}`}
                      position={[point.gps_lat, point.gps_lon]}
                      icon={blueDotIcon}
                    >
                      <Popup>
                        <div className="text-center">
                          <strong>GPS Point {idx + 1}</strong><br />
                          Lat: {point.gps_lat}<br />
                          Lon: {point.gps_lon}<br />
                          Time: {new Date(point.timestamp).toLocaleString()}<br />
                          Speed: {point.speed ?? "--"} km/h <br />
                          Event: {sendReasonMap[point.send_reason] ?? "--"}<br />
                        </div>
                      </Popup>
                    </Marker>
                  ))}

                  <Polyline
                    positions={historyData.map(p => [p.gps_lat, p.gps_lon])}
                    color="blue"
                  />

                  {historyData.map((point, idx) => (
                    <Marker
                      key={`lbs-${idx}`}
                      position={[point.lbs_lat, point.lbs_lon]}
                      icon={greenDotIcon}
                    >
                      <Popup>
                        <div className="text-center">
                          <strong>LBS Point {idx + 1}</strong><br />
                          Lat: {point.lbs_lat}<br />
                          Lon: {point.lbs_lon}<br />
                          Time: {new Date(point.timestamp).toLocaleString()} <br />
                          Event: {sendReasonMap[point.send_reason] ?? "--"}<br />
                        </div>
                      </Popup>
                    </Marker>
                  ))}

                  <Polyline
                    positions={historyData.map(p => [p.lbs_lat, p.lbs_lon])}
                    color="green"
                  />
                </>
              )}

            </MapContainer>
            
            <div className="absolute top-4 right-4 z-5 flex items-center space-x-2">
              <Button
                onClick={openInGoogleMaps}
                size="sm"
                className="bg-gray-900/80 active:bg-gray-900 text-white backdrop-blur-sm"
              >
                <NavigationIcon className="w-4 h-4 mr-2" />
                Open in Maps
              </Button>

              <Button
                onClick={() => setShowHistory(!showHistory)}
                size="sm"
                className="bg-gray-900/80 active:bg-gray-900 text-white"
              >
                {showHistory ? "Hide History" : "View History"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
              <span className="text-white">{locationData.gps_age_human ?? "--"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Event:</span>
              <span className="text-white">{sendReasonMap[locationData.send_reason] ?? "--"}</span>
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
              <span className="text-white">{locationData.lbs_age_human ?? "--"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Event:</span>
              <span className="text-white">{sendReasonMap[locationData.send_reason] ?? "--"}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LocationTab;