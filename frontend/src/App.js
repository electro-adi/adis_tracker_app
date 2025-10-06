import React, { useState, useEffect } from "react";
import "./App.css";
import Navigation from "./components/Navigation";
import LocationTab from "./components/LocationTab";
import StatusTab from "./components/StatusTab";
import PhoneTab from "./components/PhoneTab";
import LedTab from "./components/LedTab";
import IRTab from "./components/IRTab";
import SettingsTab from "./components/SettingsTab";
import CMDTab from "./components/CMDTab";
import { Toaster } from "./components/ui/toaster";
import { useToast } from "./hooks/use-toast";
import { StatusBar, Style } from '@capacitor/status-bar';
import { PushNotifications } from '@capacitor/push-notifications';
import { v4 as uuidv4 } from 'uuid';
import { ref, onValue, set } from "firebase/database";
import { db } from "./firebase";

let deviceId = localStorage.getItem('deviceId');
if (!deviceId) {
  deviceId = uuidv4();
  localStorage.setItem('deviceId', deviceId);
}

const BACKEND_URL = 'https://adis-tracker-app.onrender.com';

function App() {
  const [activeTab, setActiveTab] = useState('location');
  const { toast } = useToast();
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [trackerConnected, setTrackerConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('--');

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
    const backendRef = ref(db, 'Backend/online');
    const unsubBackend = onValue(backendRef, (snapshot) => {
      const isOnline = snapshot.val();
      setConnectionStatus(isOnline ? 'connected' : 'error');
    });

    const trackerRef = ref(db, 'Tracker/MQTT/connected');
    const unsubTracker = onValue(trackerRef, (snapshot) => {
      const isConnected = snapshot.val();
      setTrackerConnected(!!isConnected);
    });

    const lastMsgRef = ref(db, 'Tracker/MQTT/last_message');
    const unsubLastMsg = onValue(lastMsgRef, (snapshot) => {
      const timestamp = snapshot.val();
      setLastUpdate(getTimeAgo(timestamp));
    });

    const updateInterval = setInterval(() => {
      const lastMsgRef = ref(db, 'Tracker/MQTT/last_message');
      onValue(lastMsgRef, (snapshot) => {
        const timestamp = snapshot.val();
        setLastUpdate(getTimeAgo(timestamp));
      }, { onlyOnce: true });
    }, 30000);

    return () => {
      unsubBackend();
      unsubTracker();
      unsubLastMsg();
      clearInterval(updateInterval);
    };
  }, []);

  const handleNotification = (notificationData) => {
    toast({
      title: notificationData.title,
      description: notificationData.message,
    });

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notificationData.title, {
        body: notificationData.message,
        icon: '/favicon.ico',
        tag: notificationData.notification_type || "generic",
      });
    }
  };

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

          handleNotification({
            title: notification.title || 'Push Notification',
            message: notification.body || '',
            notification_type: notification.data?.type || 'push',
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
      const response = await fetch(`${BACKEND_URL}/api/`, {
        method: 'GET',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      console.log('[HEARTBEAT] Backend awake');
    } 
    catch (error) 
    {
      console.warn('[HEARTBEAT] Failed:', error.message);
    }
  };

  heartbeat();

  const interval = setInterval(heartbeat, 45_000);

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

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-950">
      <header className="fixed top-0 left-0 right-0 z-20 bg-gray-900 shadow-md" style={{ paddingTop: '50px' }}>
        <div className="px-4 py-3 border-b border-gray-700">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-white">Adi's Tracker Control</h1>
            <div className="flex flex-col items-end text-right"> 
              <div className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${ connectionStatus === 'connected' ? 'bg-green-500 shadow-[0_0_8px_0px_rgba(34,197,94,0.5)]' : connectionStatus === 'error' ? 'bg-red-500 shadow-[0_0_8px_0px_rgba(239,68,68,0.5)]' : 'bg-yellow-400 animate-pulse'}`}> </div>
                <span className={`text-sm font-medium ${ connectionStatus === 'connected' ? 'text-green-400' : connectionStatus === 'error' ? 'text-red-400' : 'text-yellow-300'}`}>
                  {connectionStatus === 'connected' ? 'Server Online' : connectionStatus === 'error' ? 'Server Error' : 'Server Connecting'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
              <div className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${ trackerConnected ? 'bg-green-500 shadow-[0_0_8px_0px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_8px_0px_rgba(239,68,68,0.5)]'}`}> </div>
                <span
                  className={`text-sm font-medium ${ trackerConnected ? 'text-green-400' : 'text-red-400'}`}> 
                  {trackerConnected ? 'Device Connected' : 'Device Disconnected'}
                </span>
              </div>
              <span className="text-xs text-gray-400 mt-0.5 opacity-90">
                Last update: {lastUpdate}
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