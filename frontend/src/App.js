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

const WS_URL  = process.env.REACT_APP_BACKEND_URL;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

let deviceId = localStorage.getItem('deviceId');
if (!deviceId) {
  deviceId = uuidv4();
  localStorage.setItem('deviceId', deviceId);
}

function App() {

  const [activeTab, setActiveTab] = useState('location');
  const [websocket, setWebsocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const { toast } = useToast();

  const [mqtt_status, setMqttStatus] = useState({
    connected: false,
    broker: "",
    port: 0,
    last_connected: 0,
    last_msg: 0,
    last_msg_human: "--",
    connection_attempts: 0,
    lastwill_time: 0,
    tracker_connected: false
  });


  //---------------------------------------------- Show notification function
  const handleNotification = (notificationData) => {
    // Show toast
    toast({
      title: notificationData.title,
      description: notificationData.message,
    });

    // Show browser notification if permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notificationData.title, {
        body: notificationData.message,
        icon: '/favicon.ico',
        tag: notificationData.notification_type || "generic",
      });
    }
  };


  //---------------------------------------------- Configure Capacitor StatusBar
  useEffect(() => {
    const configureStatusBar = async () => {
      if (window.Capacitor?.isNativePlatform()) {
        try {
          await StatusBar.setStyle({ style: Style.Dark }); 
          console.log("StatusBar configured for overlay and style.");
        } catch (e) {
          console.error("Failed to configure StatusBar", e);
        }
      }
    };
    configureStatusBar();
  }, []);
  

  //---------------------------------------------- WebSocket connection for real-time updates

  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(`${WS_URL}/ws/notifications`);
        
        ws.onopen = () => {
          console.log('WebSocket connected');
          setConnectionStatus('connected');
          setWebsocket(ws);
          
          // Send heartbeat every 30 seconds
          const heartbeat = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'heartbeat' }));
            }
          }, 30000);
          
          ws.heartbeatInterval = heartbeat;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === "notification") {
              handleNotification({
                title: data.data?.title || data.type,
                message: data.data?.message || JSON.stringify(data.data),
                notification_type: data.type
              });
            }
            else if (data.type === "status_update") {
              console.log("Dispatching status_update:", JSON.stringify(data.data));
              window.dispatchEvent(new CustomEvent("status_update", { detail: data.data }));
            }
            else if (data.type === "location_update") {
              window.dispatchEvent(new CustomEvent("location_update", { detail: data.data }));
            }
            else if (data.type === "sms_update") {
              const from = data.data?.from || "Unknown number";
              const content = data.data?.message || "--";

              handleNotification({
                title: `SMS from ${from}`,
                message: content,
                notification_type: data.type
              });
            }
            else if (data.type === "call_update") {
              const caller = data.data?.caller || "Unknown number";

              handleNotification({
                title: `Incoming call from ${caller}`,
                message: "Tap to view details.",
                notification_type: data.type
              });
            }
            else if (data.type === "led_config_update") {
              window.dispatchEvent(new CustomEvent("led_config_update", { detail: data.data }));
            }
            else if (data.type === "config_update") {
              window.dispatchEvent(new CustomEvent("config_update", { detail: data.data }));
            }
            else if (data.type === "contacts_update") {
              window.dispatchEvent(new CustomEvent("contacts_update", { detail: data.data }));
            }
            else if (data.type === "heartbeat") {
              console.log("Heartbeat..");
            }
            else
            {
              console.log('Unknown WS message type:', JSON.stringify(data));
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };


        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setConnectionStatus('disconnected');
          setWebsocket(null);
          
          // Clear heartbeat interval
          if (ws.heartbeatInterval) {
            clearInterval(ws.heartbeatInterval);
          }
          
          // Attempt to reconnect after 5 seconds
          setTimeout(connectWebSocket, 5000);
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setConnectionStatus('error');
        };

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        setConnectionStatus('error');
        // Retry connection after 5 seconds
        setTimeout(connectWebSocket, 5000);
      }
    };

    // Initial connection
    connectWebSocket();

    // Cleanup on unmount
    return () => {
      if (websocket) {
        if (websocket.heartbeatInterval) {
          clearInterval(websocket.heartbeatInterval);
        }
        websocket.close();
      }
    };
  }, []);

  //---------------------------------------------- Request mqtt status every 5 seconds
  useEffect(() => {
    const get_mqtt_status = async () => {
      try {
        const response = await fetch(`${API}/mqtt/status`);
        if (response.ok) {
          const data = await response.json();
          setMqttStatus(data);
        }
      } catch (error) {
        console.error('Failed to get mqtt status', error);
      }
    };

    get_mqtt_status();
    
    const interval = setInterval(get_mqtt_status, 5000);

    return () => clearInterval(interval);
  }, []);


  //---------------------------------------------- Send stayawake message every 35 seconds
  useEffect(() => {
    const device_stayawake = async () => {
    try {
      const response = await fetch(`${API}/device/mode/0`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Failed to send stayawake message', error);
    }
    };

    device_stayawake();

    const interval = setInterval(device_stayawake, 35000);

    return () => clearInterval(interval);
  }, []);

  //---------------------------------------------- Setup firebase notification functionality
  useEffect(() => {
    async function initPush() {

      // Request permission (Android 13+ and iOS)
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== "granted") return;

      await PushNotifications.register();

      // Token listener
      PushNotifications.addListener("registration", async (token) => {
        console.log("FCM token:", token.value);

        // Send token to backend
        await fetch(`${API}/push/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: token.value,
            deviceId: deviceId,
            userId: 'user123'
          }),
        });
      });

      // Token refresh listener
      PushNotifications.addListener("registrationError", (error) => {
        console.error("Push registration error:", error);
      });

      // Foreground + background push
      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        console.log("Push received:", notification);

        handleNotification({
          title: notification.title || "Push Notification",
          message: notification.body || "",
          notification_type: notification.data?.type || "push",
        });
      });
    }

    initPush();
  }, []);

  //---------------------------------------------- Render the active tab component padding from 33 to 50
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
                  {connectionStatus === 'connected' ? 'Server Online' : connectionStatus === 'error' ? 'Server Error' : 'Connecting...'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
              <div className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${ mqtt_status.tracker_connected ? 'bg-green-500 shadow-[0_0_8px_0px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_8px_0px_rgba(239,68,68,0.5)]'}`}> </div>
                <span
                  className={`text-sm font-medium ${ mqtt_status.tracker_connected ? 'text-green-400' : 'text-red-400'}`}> 
                  {mqtt_status.tracker_connected ? 'Device Connected' : 'Device Disconnected'}
                </span>
              </div>
              <span className="text-xs text-gray-400 mt-0.5 opacity-90">
                Last update: {mqtt_status?.last_msg_human ?? "--"}
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