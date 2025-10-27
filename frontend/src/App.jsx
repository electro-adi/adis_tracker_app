import React, { useState, useEffect } from "react";
import "./App.css";
import Navigation from "./components/Navigation";
import LocationTab from "./components/LocationTab";
import StatusTab from "./components/StatusTab";
import PhoneTab from "./components/PhoneTab";
import LedTab from "./components/LedTab";
import EspNowTAB from "./components/EspNow";
import IRTab from "./components/IRTab";
import SettingsTab from "./components/SettingsTab";
import CMDTab from "./components/CMDTab";
import { Toaster } from "./components/ui/toaster";
import { useToast } from "./hooks/use-toast";
import { StatusBar, Style } from '@capacitor/status-bar';
import { PushNotifications } from '@capacitor/push-notifications';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, ref, onValue, onDisconnect, set } from "firebase/database";
import { db } from "./firebase";

let deviceId = localStorage.getItem('deviceId');
if (!deviceId) {
  deviceId = uuidv4();
  localStorage.setItem('deviceId', deviceId);
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

function App() {
  const [activeTab, setActiveTab] = useState('location');
  const { toast } = useToast();
  const [serverConnected, setServerConnected] = useState(false);
  const [trackerConnected, setTrackerConnected] = useState(false);
  const [trackerAwake, setTrackerAwake] = useState(false);
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [appLaunchTime] = useState(Date.now());

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

  const getServerStatus = () => {
    const timeSinceLaunch = (currentTime - appLaunchTime) / 1000;
    
    if (serverConnected) {
      return {
        text: 'Server Online',
        color: 'text-green-400',
        dotColor: 'bg-green-500 shadow-[0_0_8px_0px_rgba(34,197,94,0.5)] animate-pulse'
      };
    }
    
    if (timeSinceLaunch < 100) {
      return {
        text: 'Waiting for server...',
        color: 'text-yellow-400',
        dotColor: 'bg-yellow-400 shadow-[0_0_8px_0px_rgba(250,204,21,0.5)]'
      };
    }
    
    return {
      text: 'Server Offline',
      color: 'text-red-400',
      dotColor: 'bg-red-500 shadow-[0_0_8px_0px_rgba(239,68,68,0.5)]'
    };
  };

  const getTrackerStatus = () => {
    if (!trackerConnected) {
      return {
        text: 'Device Disconnected',
        color: 'text-red-400',
        dotColor: 'bg-red-500 shadow-[0_0_8px_0px_rgba(239,68,68,0.5)]'
      };
    }
    
    if (trackerAwake) {
      return {
        text: 'Device Awake',
        color: 'text-green-400',
        dotColor: 'bg-green-500 shadow-[0_0_8px_0px_rgba(34,197,94,0.5)] animate-pulse'
      };
    }
    
    return {
      text: 'Device Asleep',
      color: 'text-blue-400',
      dotColor: 'bg-blue-500 shadow-[0_0_8px_0px_rgba(59,130,246,0.5)]'
    };
  };

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      * { 
        -webkit-user-drag: none !important;
        user-drag: none !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    const backendRef = ref(db, 'Backend/online');
    const unsubBackend = onValue(backendRef, (snapshot) => {
      const isOnline = snapshot.val();
      setServerConnected(!!isOnline);
    });

    const trackerRef = ref(db, 'Tracker/MQTT/connected');
    const unsubTracker = onValue(trackerRef, (snapshot) => {
      const isConnected = snapshot.val();
      setTrackerConnected(!!isConnected);
    });

    const awakeRef = ref(db, 'Tracker/status/latest/currently_active');
    const unsubAwake = onValue(awakeRef, (snapshot) => {
      const isAwake = snapshot.val();
      setTrackerAwake(!!isAwake);
    });

    const lastMsgRef = ref(db, 'Tracker/MQTT/last_message');
    const unsubLastMsg = onValue(lastMsgRef, (snapshot) => {
      const timestamp = snapshot.val();
      setLastUpdateTimestamp(timestamp);
    });

    const timeInterval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      unsubBackend();
      unsubTracker();
      unsubAwake();
      unsubLastMsg();
      clearInterval(timeInterval);
    };
  }, []);

  useEffect(() => {
    const dbRef = getDatabase();
    const connectedRef = ref(dbRef, ".info/connected");
    const presenceRef = ref(dbRef, `Frontend`);

    const unsubscribe = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        onDisconnect(presenceRef).set({
          online: false,
          last_offline: new Date().toISOString()
        });

        set(presenceRef, {
          online: true,
          last_online: new Date().toISOString()
        });
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const configureStatusBar = async () => {
      if (window.Capacitor?.isNativePlatform()) {
        try {
          await StatusBar.setStyle({ style: Style.Dark }); 
        } catch (e) {
          console.error("Failed to configure StatusBar", e);
        }
      }
    };
    configureStatusBar();
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function initPush() {
      try {
        const result = await PushNotifications.requestPermissions();
        console.log('[PUSH] permission', result);

        if (result.receive === 'granted') {
          await PushNotifications.register();
        } else {
          console.warn('[PUSH] permission not granted');
          return;
        }

        PushNotifications.addListener('registration', async (token) => {
          if (!isMounted) return;
          console.log('[PUSH] registration token', token.value);

          const tokenRef = ref(db, `PushTokens/default_user`);
          await set(tokenRef, {
            token: token.value,
            deviceId,
            userId: 'user123',
            timestamp: new Date().toISOString(),
          });
        });

        PushNotifications.addListener('registrationError', (error) => {
          if (!isMounted) return;
          console.error('[PUSH] registrationError', error);
        });

        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          if (!isMounted) return;
          console.log('[PUSH] received', notification);

          toast({
            title: notification.title,
            description: notification.body
          });
        });
      } catch (err) {
        console.error('[PUSH] initPush error', err);
      }
    }

    initPush();

    return () => {
      isMounted = false;
    };
  }, []);

useEffect(() => {
  const heartbeat = async () => {
    try 
    {
      const response = await fetch(`${BACKEND_URL}/api/heartbeat`, {
        method: 'GET',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      console.log('[HEARTBEAT] Backend awake');
    } 
    catch (error) 
    {
      console.warn('[HEARTBEAT] Failed:', error.message);
      toast({
        title: "Error",
        description: "Backend: " + error.message,
        variant: "destructive"
      });
    }
  };

  heartbeat();

  const interval = setInterval(heartbeat, 60_000);

  return () => clearInterval(interval);
}, []);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'location':
        return <LocationTab />;
      case 'status':
        return <StatusTab />;
      case 'phone':
        return <PhoneTab />;
      case 'led':
        return <LedTab />;
      case 'espnow':
        return <EspNowTAB />;
      case 'remote':
        return <IRTab />;
      case 'settings':
        return <SettingsTab />;
      case 'cmd':
        return <CMDTab />;
      default:
        return <LocationTab />;
    }
  };

  const serverStatus = getServerStatus();
  const trackerStatus = getTrackerStatus();

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-950">
      <header className="fixed top-0 left-0 right-0 z-20 bg-gray-900 shadow-md" style={{ paddingTop: '50px' }}>
        <div className="px-4 py-3 border-b border-gray-700">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-white">Adi's Tracker Control</h1>
            <div className="flex flex-col items-end text-right"> 
              <div className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${serverStatus.dotColor}`}></div>
                <span className={`text-sm font-medium ${serverStatus.color}`}>
                  {serverStatus.text}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${trackerStatus.dotColor}`}></div>
                <span className={`text-sm font-medium ${trackerStatus.color}`}>
                  {trackerStatus.text}
                </span>
              </div>
              <span className="text-xs text-gray-400 mt-0.5 opacity-90">
                Last update: {getTimeAgo(lastUpdateTimestamp)}
              </span>
            </div>
          </div>
        </div>
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      </header>
      <main className="flex-grow overflow-y-auto"
        style={{ 
          paddingTop: `calc(env(safe-area-inset-top) + 140px)`,
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}>
        <div className="pb-6">
            {renderActiveTab()}
        </div>
      </main>
      <Toaster />
    </div>
  );
}
export default App;