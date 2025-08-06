import React, { useState, useEffect } from "react";
import "./App.css";
import Navigation from "./components/Navigation";
import LocationTab from "./components/LocationTab";
import StatusTab from "./components/StatusTab";
import PhoneTab from "./components/PhoneTab";
import LedTab from "./components/LedTab";
import SettingsTab from "./components/SettingsTab";
import { Toaster } from "./components/ui/toaster";
import { useToast } from "./hooks/use-toast";
import { StatusBar, Style } from '@capacitor/status-bar';

const WS_URL  = process.env.REACT_APP_BACKEND_URL;

function App() {
  const [activeTab, setActiveTab] = useState('location');
  const [websocket, setWebsocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const { toast } = useToast();

  useEffect(() => {
    const hideStatusBar = async () => {
      await StatusBar.hide();
    };
    hideStatusBar();
  }, []);

  // WebSocket connection for real-time updates
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
            
            if (data.type === 'notification') {
              // Show browser notification
              showNotification(data.data);
            } else if (data.type === 'status_update') {
              // Handle device status updates
              console.log('Device status updated:', data.data);
            } else if (data.type === 'location_update') {
              // Handle GPS location updates
              console.log('Location updated:', data.data);
            } else if (data.type === 'sms_update') {
              // Handle SMS updates
              console.log('SMS received:', data.data);
              toast({
                title: "SMS Received",
                description: `From ${data.data.number}: ${data.data.message.substring(0, 50)}...`,
              });
            } else if (data.type === 'call_update') {
              // Handle incoming call notifications
              console.log('Incoming call:', data.data);
              toast({
                title: "Incoming Call",
                description: `Device receiving call from: ${data.data.caller}`,
                variant: "default",
              });
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

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }
  }, []);

  const showNotification = (notificationData) => {
    // Show toast notification
    toast({
      title: notificationData.title,
      description: notificationData.message,
    });

    // Show browser notification if permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notificationData.title, {
        body: notificationData.message,
        icon: '/favicon.ico',
        tag: notificationData.notification_type
      });
    }
  };

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
      case 'settings':
        return <SettingsTab />;
      default:
        return <LocationTab />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="sticky top-0 z-10">
        <div className="bg-gray-900 px-4 py-3 border-b border-gray-700">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-white">Adi's Tracker Companion</h1>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-400' : 
                connectionStatus === 'error' ? 'bg-red-400' : 'bg-yellow-400'
              }`}></div>
              <span className="text-xs text-gray-400">
                {connectionStatus === 'connected' ? 'Live' : 
                 connectionStatus === 'error' ? 'Error' : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
      <main className="pb-6">
        {renderActiveTab()}
      </main>
      <Toaster />
    </div>
  );
}

export default App;