import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { 
  Battery, 
  Signal, 
  Smartphone, 
  RefreshCw,
  Clock,
} from 'lucide-react';
import { useToast } from "../hooks/use-toast";
import { ref, onValue, set } from 'firebase/database';
import { db } from "../firebase";

const StatusTab = () => {
  const [status, setStatus] = useState({
    send_reason: 0,
    screen_on: false,
    sleep_mode: false,
    currently_active: false,
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
    ble_beacon: false,
    gps_fix: false,
    prd_wakeup_counter: 0,
    temp_contact: "",
    build: "",
    timestamp: ""
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
    const statusRef = ref(db, 'Tracker/status/latest');
    const unsubStatus = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStatus({
          send_reason: data.send_reason || 0,
          screen_on: data.screen_on || false,
          sleep_mode: data.sleep_mode || false,
          currently_active: data.currently_active || false,
          last_activity: data.last_activity || 0,
          last_activity_human: data.last_activity,
          bat_voltage: data.bat_voltage || 0,
          bat_percent: data.bat_percent || 0,
          gsm_rssi: data.gsm_rssi || 0,
          wifi_enabled: data.wifi_enabled || false,
          wifi_rssi: data.wifi_rssi || 0,
          wifi: data.wifi || "--",
          in_call: data.in_call || false,
          locked: data.locked || false,
          light_level: data.light_level || 0,
          uptime: data.uptime || "--",
          espnow_state: data.espnow_state || 0,
          stored_sms: data.stored_sms || 0,
          prd_eps: data.prd_eps || false,
          ble_beacon: data.ble_beacon || false,
          gps_fix: data.gps_fix || false,
          prd_wakeup_counter: data.prd_wakeup_counter || 0,
          temp_contact: data.temp_contact || "--",
          build: data.build || "--",
          timestamp: data.timestamp || "--"
        });
      }
    });

    const timeInterval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      unsubStatus();
      clearInterval(timeInterval);
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
        title: "Request Sent",
        description: "Device status update requested."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to request status update.",
        variant: "destructive"
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
    <div className="px-[6vw] py-[5vh] space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Device Status</h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-400">{getTimeAgo(status.timestamp)}</span>
          <Button 
            onClick={refreshStatus} 
            variant="outline"
            className={`
              border-gray-600 text-gray-300
              active:bg-gray-800 active:text-gray-200
              disabled:opacity-50
            `}>
              <span className="relative z-10 flex items-center justify-center">
                {loading ? (
                  <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  </>
                ) : (
                  <>
                    <RefreshCw className={`w-4 h-4 mr-2`} />
                    Refresh
                  </>
                )}
              </span>
            </Button>
        </div>
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
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Event:</span>
              <span className={sendReasonMap[status.send_reason] ? "text-white" : "text-gray-500"}>
                {sendReasonMap[status.send_reason] ?? "--"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Deepsleep:</span>
              <span className={status.sleep_mode ? "text-white" : "text-gray-500"}>
                {status.sleep_mode ? "On" : "Off"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Screen:</span>
              <span className={status.screen_on ? "text-white" : "text-gray-500"}>
                {status.screen_on ? "On" : "Off"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Locked:</span>
              <div className="flex items-center">
                <span className={status.locked ? "text-white" : "text-gray-500"}>
                  {status.locked ? "Yes" : "No"}
                </span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Wakeup Counter:</span>
              <span className={status.prd_wakeup_counter === 0 ? "text-gray-500" : "text-white"}>
                {status.prd_wakeup_counter}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Light Level:</span>
              <span className="text-white">{status.light_level} lux</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Extreme Power Saving Mode:</span>
              <span className={status.prd_eps ? "text-white" : "text-gray-500"}>
                {status.prd_eps ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">BLE Beacon Mode:</span>
              <span className={status.ble_beacon ? "text-white" : "text-gray-500"}>
                {status.ble_beacon ? "Enabled" : "Disabled"}
              </span>
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
                <span className={status.espnow_state ? "text-white" : "text-gray-500"}>
                  {status.espnow_state ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">WiFi:</span>
              <div className="flex items-center">
                <span className={status.wifi_enabled ? "text-white" : "text-gray-500"}>
                  {status.wifi_enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
            {status.wifi_enabled && (
              <div className="flex justify-between">
                <span className="text-gray-400">WiFi RSSI:</span>
                <span className="text-white">{status.wifi_rssi} dBm</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">In Call:</span>
              <span className={status.in_call ? "text-white" : "text-gray-500"}>
                {status.in_call ? "Yes" : "No"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Temp Contact:</span>
              <span className={status.temp_contact ? "text-white" : "text-gray-500"}>
                {status.temp_contact ?? "--"}
              </span>
            </div>
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
              <span className="text-gray-400">Last Activity:</span>
              <span className="text-white">{getTimeAgo(status.last_activity_human)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Uptime:</span>
              <span className="text-white font-mono">{status.uptime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Build:</span>
              <span className="text-white font-mono">{status.build}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StatusTab;