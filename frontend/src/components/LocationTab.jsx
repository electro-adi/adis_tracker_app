import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { MapPin, Satellite, RadioTower, Navigation, History, Clock, MapPinned } from 'lucide-react';
import { useToast } from "../hooks/use-toast";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ref, onValue, set } from 'firebase/database';
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

const FitBoundsToMarkers = ({ gps, lbs, shouldRecenter, onRecenterComplete }) => {
  const map = useMap();

  useEffect(() => {
    if (!gps || !lbs || !shouldRecenter) return;

    const bounds = L.latLngBounds([gps, lbs]);
    map.fitBounds(bounds, { padding: [30, 30] });
    onRecenterComplete();
  }, [gps, lbs, map, shouldRecenter, onRecenterComplete]);

  return null;
};

const LocationTab = () => {
  const [shouldRecenter, setShouldRecenter] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false); 

  const [locationData, setLocationData] = useState({
    send_reason_gps: 0,
    send_reason_lbs: 0,
    gps_lat: 49.9180204,
    gps_lon: 19.937429,
    lbs_lat: 49.9208907,
    lbs_lon: 19.9448864,
    sats: 0,
    alt: 0.0,
    speed: 0.0,
    course: 0.0,
    gps_timestamp: null,
    lbs_timestamp: null,
    gps_age_human: "--",
    lbs_age_human: "--",
  });

  const sendReasonMap = {
    0: "Boot",
    1: "Request",
    2: "Request (Sleep)",
    3: "Fix Found",
    4: "Fix Found (Sleep)",
    5: "Periodic Wakeup",
    6: "Going to Sleep"
  };

  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [historyList, setHistoryList] = useState([]);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const getTimeAgo = (isoString) => {
    if (!isoString) return '--';
    const now = currentTime;
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
    const timeInterval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  useEffect(() => {
    const locationRef = ref(db, 'Tracker/location/latest');
    const unsubLocation = onValue(locationRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setLocationData({
          send_reason_gps: data.send_reason_gps || 0,
          send_reason_lbs: data.send_reason_lbs || 0,
          gps_lat: data.gps_lat || 49.9180204,
          gps_lon: data.gps_lon || 19.937429,
          lbs_lat: data.lbs_lat || 49.9208907,
          lbs_lon: data.lbs_lon || 19.9448864,
          sats: data.sats || 0,
          alt: data.alt || 0.0,
          speed: data.speed || 0.0,
          course: data.course || 0.0,
          gps_timestamp: data.gps_timestamp,
          lbs_timestamp: data.lbs_timestamp,
          gps_age_human: getTimeAgo(data.gps_timestamp),
          lbs_age_human: getTimeAgo(data.lbs_timestamp),
        });
        
        if (!isDataLoaded) {
          setIsDataLoaded(true);
          setShouldRecenter(true);
        }
      }
    });

    return () => {
      unsubLocation();
    };
  }, [currentTime, isDataLoaded]);

  useEffect(() => {
    const historyRef = ref(db, 'Tracker/location/history');
    const unsubHistory = onValue(historyRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const historyArray = Object.values(data)
          .sort((a, b) => new Date(a.gps_timestamp) - new Date(b.gps_timestamp));
        setHistoryList(historyArray);
        
        if (showHistory) {
          const mapHistory = historyArray
            .sort((a, b) => new Date(b.gps_timestamp) - new Date(a.gps_timestamp))
            .slice(0, 50);
          setHistoryData(mapHistory);
        }
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
        title: "Request Sent",
        description: "Request sent for new location data."
      });
    } catch (error) {
      console.error('Location request failed:', error);
      toast({
        title: "Error",
        description: "Failed to send location request.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const openInGoogleMaps = (lat, lon) => {
    const url = `https://www.google.com/maps?q=${lat},${lon}`;
    window.open(url, '_blank');
  };

  const handleHistoryClick = (entry) => {
    openInGoogleMaps(entry.gps_lat, entry.gps_lon);
  };

  const recenterMap = () => {
    setShouldRecenter(true);
  };

  return (
    <div className="px-[6vw] py-[5vh] space-y-6">
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-white">Device Location</h1>
        <Button
          onClick={requestLocation}
          disabled={loading}
          className="bg-gradient-to-br from-sky-600 to-blue-600 text-white font-semibold hover:bg-blue-600 px-4 py-2 rounded-lg shadow-md flex-shrink-0"
        >   
          <span className="relative z-10 flex items-center justify-center">
            {loading ? (
              <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Requesting...
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 mr-2" />
                Request Location
              </>
            )}
          </span>
        </Button>
      </div>

      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-0">
          <div className="h-96 bg-gray-700 rounded-lg relative overflow-hidden">
            {typeof window !== "undefined" && (
              <MapContainer
                center={[locationData.gps_lat, locationData.gps_lon]}
                zoom={15}
                style={{ height: "100%", width: "100%" }}
                className="rounded-lg"
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />

                <FitBoundsToMarkers
                  gps={[locationData.gps_lat, locationData.gps_lon]}
                  lbs={[locationData.lbs_lat, locationData.lbs_lon]}
                  shouldRecenter={shouldRecenter}
                  onRecenterComplete={() => setShouldRecenter(false)}
                />

                <Marker position={[locationData.gps_lat, locationData.gps_lon]} icon={blueIcon}>
                  <Popup>
                    <div className="text-center">
                      <strong>GPS Location</strong><br />
                      Lat: {locationData.gps_lat}<br />
                      Lon: {locationData.gps_lon}<br />
                      Satellites: {locationData.sats ?? "--"}<br />
                      Speed: {locationData.speed ?? "--"} km/h <br />
                      Age: {getTimeAgo(locationData.gps_timestamp)}<br />
                      Event: {sendReasonMap[locationData.send_reason_gps] ?? "--"}<br />
                    </div>
                  </Popup>
                </Marker>

                <Marker position={[locationData.lbs_lat, locationData.lbs_lon]} icon={greenIcon}>
                  <Popup>
                    <div className="text-center">
                      <strong>LBS Location</strong><br />
                      Lat: {locationData.lbs_lat}<br />
                      Lon: {locationData.lbs_lon}<br />
                      Age: {getTimeAgo(locationData.lbs_timestamp)}<br />
                      Event: {sendReasonMap[locationData.send_reason_lbs] ?? "--"}<br />
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
                            Time: {new Date(point.gps_timestamp).toLocaleString()}<br />
                            Speed: {point.speed ?? "--"} km/h <br />
                            Event: {sendReasonMap[point.send_reason_gps] ?? "--"}<br />
                          </div>
                        </Popup>
                      </Marker>
                    ))}

                    <Polyline positions={historyData.map(p => [p.gps_lat, p.gps_lon])} color="blue" />

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
                            Time: {new Date(point.lbs_timestamp).toLocaleString()}<br />
                            Event: {sendReasonMap[point.send_reason_lbs] ?? "--"}<br />
                          </div>
                        </Popup>
                      </Marker>
                    ))}

                    <Polyline positions={historyData.map(p => [p.lbs_lat, p.lbs_lon])} color="green" />
                  </>
                )}
              </MapContainer>
            )}

            <div className="absolute top-4 right-4 z-5 flex items-center space-x-2">
              <Button
                onClick={recenterMap}
                size="sm"
                className="bg-gray-900/80 active:bg-gray-900 text-white backdrop-blur-sm"
              >
                <MapPin className="w-4 h-4" />
              </Button>

              <Button
                onClick={() => openInGoogleMaps(locationData.gps_lat, locationData.gps_lon)}
                size="sm"
                className="bg-gray-900/80 active:bg-gray-900 text-white backdrop-blur-sm"
              >
                <Navigation className="w-4 h-4 mr-2" />
                Maps
              </Button>

              <Button
                onClick={() => setShowHistory(!showHistory)}
                size="sm"
                className="bg-gray-900/80 active:bg-gray-900 text-white"
              >
                {showHistory ? "Hide" : "History"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
              <span className={locationData.sats === 0 ? "text-gray-500" : "text-white"}>
                {locationData.sats === 0 ? "--" : `${locationData.sats}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Altitude:</span>
              <span className={locationData.alt === 0 ? "text-gray-500" : "text-white"}>
                {locationData.alt === 0 ? "--" : `${locationData.alt} m`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Speed:</span>
              <span className={locationData.speed === 0 ? "text-gray-500" : "text-white"}>
                {locationData.speed === 0 ? "--" : `${locationData.speed} km/h`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Course:</span>
              <span className={locationData.course === 0 ? "text-gray-500" : "text-white"}>
                {locationData.course === 0 ? "--" : `${locationData.course}°`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Data Age:</span>
              <span className="text-white">
                {getTimeAgo(locationData.gps_timestamp)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Event:</span>
              <span className="text-white">{sendReasonMap[locationData.send_reason_gps] ?? "--"}</span>
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
              <span className="text-white">
                {getTimeAgo(locationData.lbs_timestamp)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Event:</span>
              <span className="text-white">{sendReasonMap[locationData.send_reason_lbs] ?? "--"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <History className="w-5 h-5 mr-2 text-purple-400" />
              Location History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <style>{`
              .history-scroll::-webkit-scrollbar {
                width: 8px;
              }
              .history-scroll::-webkit-scrollbar-track {
                background: #1f2937;
                border-radius: 4px;
              }
              .history-scroll::-webkit-scrollbar-thumb {
                background: #4b5563;
                border-radius: 4px;
              }
              .history-scroll::-webkit-scrollbar-thumb:hover {
                background: #6b7280;
              }
            `}</style>
            <div className="max-h-80 overflow-y-scroll history-scroll p-4 space-y-2">
              {historyList.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No history available
                </div>
              ) : (
                historyList.slice().reverse().map((entry, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleHistoryClick(entry)}
                    className="bg-gray-700 rounded-lg p-3 border border-gray-600 hover:border-blue-500 hover:bg-gray-650 transition-all cursor-pointer active:scale-98"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-400" />
                        <span className="text-base font-semibold text-white">
                          {getTimeAgo(entry.gps_timestamp)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-blue-600 px-3 py-1 rounded-full">
                        <MapPinned className="w-3.5 h-3.5 text-white" />
                        <span className="text-sm font-bold text-white">
                          {entry.distance_from_last_update}m
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex gap-4">
                      <div className="flex-1 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">GPS:</span>
                          <span className={entry.gps_fix ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                            {entry.gps_fix ? "✓" : "✗"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Sats:</span>
                          <span className="text-white">{entry.sats}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Event:</span>
                          <span className="text-white text-[10px]">{sendReasonMap[entry.send_reason_gps]}</span>
                        </div>
                      </div>
                      
                      <div className="w-px bg-gray-600"></div>
                      
                      <div className="flex-1 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">LBS:</span>
                          <span className={entry.lbs_fix ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                            {entry.lbs_fix ? "✓" : "✗"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Speed:</span>
                          <span className="text-white">{entry.speed} km/h</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Alt:</span>
                          <span className="text-white">{entry.alt} m</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LocationTab;