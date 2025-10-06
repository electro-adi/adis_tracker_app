import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Battery, 
  Wifi, 
  Signal, 
  Smartphone, 
  Lock, 
  Unlock,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { ref, onValue, set } from 'firebase/database';
import { db } from "../firebase";

const StatusTab = () => {
  const [status, setStatus] = useState({
    send_reason: 0,
    screen_on: false,
    last_activity: 0,
    last_activity_human: "--",
    bat_voltage: 0,
    bat_percent: 0,
    gsm_rssi: 0,
    wifi_enabled: false,
    wifi_rssi: 0,
    wifi: "",
    in_call: false,
    locked: false,
    light_level: 0,
    uptime: "00:00:00",
    espnow_state: 0,
    stored_sms: 0,
    prd_eps: false,
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
    const statusRef = ref(db, 'Tracker/status/latest');
    const unsubStatus = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStatus({
          send_reason: data.send_reason || 0,
          screen_on: data.screen_on || false,
          last_activity: data.last_activity || 0,
          last_activity_human: getTimeAgo(data.last_activity),
          bat_voltage: data.bat_voltage || 0,
          bat_percent: data.bat_percent || 0,
          gsm_rssi: data.gsm_rssi || 0,
          wifi_enabled: data.wifi_enabled || false,
          wifi_rssi: data.wifi_rssi || 0,
          wifi: data.wifi || "",
          in_call: data.in_call || false,
          locked: data.locked || false,
          light_level: data.light_level || 0,
          uptime: data.uptime || "00:00:00",
          espnow_state: data.espnow_state || 0,
          stored_sms: data.stored_sms || 0,
          prd_eps: data.prd_eps || false,
        });
      }
    });

    const updateInterval = setInterval(() => {
      setStatus(prev => ({
        ...prev,
        last_activity_human: getTimeAgo(prev.last_activity),
      }));
    }, 30000);

    return () => {
      unsubStatus();
      clearInterval(updateInterval);
    };
  }, []);

  const refreshStatus = async () => {
    setLoading(true);
    try {
      const commandRef = ref(db, 'Tracker/commands');
      await set(commandRef, {
        command: 'get_status',
        data1: ' ',
        data2: ' ',
        timestamp: new Date().toISOString(),
        pending: true
      });
      
      toast({
        title: "Status Updated",
        description: "Device status refresh requested.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to request status refresh.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getBatteryColor = (percent) => {
    if (percent > 60) return 'text-green-400';
    if (percent > 30) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getSignalColor = (rssi) => {
    if (rssi > 15) return 'text-green-400';
    if (rssi > 8) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Device Status</h1>
        <Button 
          onClick={refreshStatus} 
          disabled={loading}
          variant="outline"
          className={`
            border-gray-600 text-gray-300
            hover:bg-gray-700 hover:text-gray-200
            active:bg-gray-800
            focus:bg-transparent
            focus:text-gray-300
            focus:border-gray-600
            focus-visible:ring-1 
            focus-visible:ring-blue-500
            focus-visible:ring-offset-2
            focus-visible:ring-offset-gray-950
            disabled:opacity-50
          `}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center justify-between">
              <div className="flex items-center">
                <Smartphone className="w-5 h-5 mr-2 text-blue-400" />
                Device
              </div>
                <Badge
                  variant={
                    [0, 1, 3].includes(status.send_reason) ? "default" : "destructive"
                  }
                  className={
                    [0, 1, 3].includes(status.send_reason) ? "bg-green-600" : "bg-red-600"
                  }
                >
                  {[0, 1, 3].includes(status.send_reason) ? "Awake" : "Asleep"}
                </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Screen:</span>
              <span className="text-white">{status.screen_on ? 'On' : 'Off'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Locked:</span>
              <div className="flex items-center">
                {status.locked ? (
                  <Lock className="w-4 h-4 text-red-400 mr-1" />
                ) : (
                  <Unlock className="w-4 h-4 text-green-400 mr-1" />
                )}
                <span className="text-white">{status.locked ? 'Yes' : 'No'}</span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Event:</span>
              <span className="text-white">{sendReasonMap[status.send_reason] ?? "--"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center">
              <Battery className={`w-5 h-5 mr-2 ${getBatteryColor(status.bat_percent)}`} />
              Battery
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Voltage:</span>
              <span className="text-white">{status.bat_voltage}V</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Level:</span>
              <span className={`font-semibold ${getBatteryColor(status.bat_percent)}`}>
                {status.bat_percent}%
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  status.bat_percent > 60 ? 'bg-green-400' : 
                  status.bat_percent > 30 ? 'bg-yellow-400' : 'bg-red-400'
                }`}
                style={{ width: `${status.bat_percent}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center">
              <Signal className={`w-5 h-5 mr-2 ${getSignalColor(status.gsm_rssi)}`} />
              Connectivity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">4G Signal:</span>
              <span className={getSignalColor(status.gsm_rssi)}>{status.gsm_rssi} dBm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">ESP-NOW:</span>
              <div className="flex items-center">
                <Wifi className={`w-4 h-4 mr-1 ${status.espnow_state ? 'text-green-400' : 'text-gray-500'}`} />
                <span className="text-white">{status.espnow_state ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">WiFi:</span>
              <div className="flex items-center">
                <Wifi className={`w-4 h-4 mr-1 ${status.wifi_enabled ? 'text-green-400' : 'text-gray-500'}`} />
                <span className="text-white">{status.wifi_enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
            {status.wifi_enabled && (
              <div className="flex justify-between">
                <span className="text-gray-400">WiFi RSSI:</span>
                <span className="text-white">{status.wifi_rssi} dBm</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Clock className="w-5 h-5 mr-2 text-purple-400" />
              System Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Uptime:</span>
              <span className="text-white font-mono">{status.uptime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Last Activity:</span>
              <span className="text-white">{status.last_activity_human}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Light Level:</span>
              <span className="text-white">{status.light_level} lux</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">In Call:</span>
              <span className="text-white">{status.in_call ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Extreme Power Saving Mode:</span>
              <span className="text-white">{status.prd_eps ? 'Active' : 'Inactive'}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StatusTab;