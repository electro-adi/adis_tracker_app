import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { 
  Settings, 
  Volume2, 
  Vibrate, 
  Bell, 
  Power, 
  RotateCcw,
  Shield,
  Smartphone,
  Save,
  MessageSquareShare
} from 'lucide-react';
import { useToast } from "../hooks/use-toast";
import { ref, onValue, update, set } from 'firebase/database';
import { db } from '../firebase';

const SettingsTab = () => {
  const [settings, setSettings] = useState({
    call_mode: 2,
    gps_mode: 0,
    boot_animation: true,
    enable_buzzer: true,
    enable_haptics: true,
    boot_sms: false,
    noti_sound: true,
    noti_ppp: true,
    ringtone: 1,
    sms_thru_mqtt: true,
    DS_call_mode: 3,
    prd_wakeup: false,
    prd_wakeup_time: 120,
    prd_sms_intvrl: 0,
    prd_mqtt_intvrl: 0
  });
  
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const commandRef = ref(db, 'Tracker/commands');
    set(commandRef, {
      command: 'get_config',
      data1: ' ',
      data2: ' ',
      timestamp: new Date().toISOString(),
      pending: true
    });

    const configRef = ref(db, 'Tracker/deviceconfig');
    const unsubConfig = onValue(configRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSettings({
          call_mode: data.call_mode !== undefined ? data.call_mode : 2,
          gps_mode: data.gps_mode !== undefined ? data.gps_mode : 0,
          boot_animation: data.boot_animation !== undefined ? data.boot_animation : true,
          enable_buzzer: data.enable_buzzer !== undefined ? data.enable_buzzer : true,
          enable_haptics: data.enable_haptics !== undefined ? data.enable_haptics : true,
          boot_sms: data.boot_sms !== undefined ? data.boot_sms : false,
          noti_sound: data.noti_sound !== undefined ? data.noti_sound : true,
          noti_ppp: data.noti_ppp !== undefined ? data.noti_ppp : true,
          ringtone: data.ringtone !== undefined ? data.ringtone : 1,
          sms_thru_mqtt: data.sms_thru_mqtt !== undefined ? data.sms_thru_mqtt : true,
          DS_call_mode: data.DS_call_mode !== undefined ? data.DS_call_mode : 3,
          prd_wakeup: data.prd_wakeup !== undefined ? data.prd_wakeup : false,
          prd_wakeup_time: data.prd_wakeup_time !== undefined ? data.prd_wakeup_time : 120,
          prd_sms_intvrl: data.prd_sms_intvrl !== undefined ? data.prd_sms_intvrl : 0,
          prd_mqtt_intvrl: data.prd_mqtt_intvrl !== undefined ? data.prd_mqtt_intvrl : 0
        });
      }
    });

    return () => unsubConfig();
  }, []);

  const formatWakeupTime = (minutes) => {
    if (minutes < 60) {
      return `${minutes} minutes`;
    }
    
    const totalHours = minutes / 60;
    const days = Math.floor(totalHours / 24);
    const hours = Math.floor(totalHours % 24);
    const remainingMinutes = minutes % 60;

    if (days > 0) {
      if (hours === 0 && remainingMinutes === 0) {
        return `${days} ${days === 1 ? 'day' : 'days'}`;
      } else if (remainingMinutes === 0) {
        return `${days}d ${hours}h`;
      } else {
        return `${days}d ${hours}h ${remainingMinutes}m`;
      }
    } else {
      if (remainingMinutes === 0) {
        return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
      } else {
        return `${hours}h ${remainingMinutes}m`;
      }
    }
  };

  const getIntervalTime = (wakeups) => {
    if (wakeups === 0) return "";
    const totalMinutes = settings.prd_wakeup_time * wakeups;
    return ` (Every ${formatWakeupTime(totalMinutes)})`;
  };

  // Convert minutes to logarithmic scale position (0-100)
  const minutesToSlider = (minutes) => {
    const minLog = Math.log(5);
    const maxLog = Math.log(28800);
    const scale = 100 / (maxLog - minLog);
    return (Math.log(minutes) - minLog) * scale;
  };

  // Convert slider position (0-100) to minutes using logarithmic scale
  const sliderToMinutes = (position) => {
    const minLog = Math.log(5);
    const maxLog = Math.log(28800);
    const scale = (maxLog - minLog) / 100;
    let minutes = Math.round(Math.exp(minLog + position * scale));
    
    if (minutes <= 60) {
      // Below 1 hour: snap to 5-minute intervals
      minutes = Math.round(minutes / 5) * 5;
    } else if (minutes <= 1440) {
      // Below 1 day: snap to 30-minute intervals
      minutes = Math.round(minutes / 30) * 30;
    } else if (minutes <= 10080) {
      // Below 1 week: snap to 6-hour (360 min) intervals
      minutes = Math.round(minutes / 360) * 360;
    } else {
      // Above 1 week: snap to 1-day (1440 min) intervals
      minutes = Math.round(minutes / 1440) * 1440;
    }
    
    return Math.max(5, Math.min(28800, minutes));
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleWakeupSliderChange = (e) => {
    const sliderValue = parseInt(e.target.value);
    const minutes = sliderToMinutes(sliderValue);
    updateSetting('prd_wakeup_time', minutes);
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const configRef = ref(db, 'Tracker/deviceconfig');
      await update(configRef, {
        ...settings,
        timestamp: new Date().toISOString()
      });

      const commandRef = ref(db, 'Tracker/commands');
      await set(commandRef, {
        command: 'set_config',
        data1: ' ',
        data2: ' ',
        timestamp: new Date().toISOString(),
        pending: true
      });

      toast({
        title: "Settings Saved",
        description: "Device settings have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetToDefaults = () => {
    setSettings({
      call_mode: 2,
      gps_mode: 0,
      boot_animation: true,
      enable_buzzer: true,
      enable_haptics: true,
      boot_sms: false,
      noti_sound: true,
      noti_ppp: true,
      ringtone: 1,
      sms_thru_mqtt: true,
      DS_call_mode: 3,
      prd_wakeup: false,
      prd_wakeup_time: 120,
      prd_sms_intvrl: 0,
      prd_mqtt_intvrl: 0
    });
    toast({
      title: "Settings Reset",
      description: "All settings have been reset to default values.",
    });
  };

  const UpdateMode = async (mode) => {
    setLoading(true);
    try {
      const commandRef = ref(db, 'Tracker/commands');
      await set(commandRef, {
        command: 'mode',
        data1: mode,
        data2: ' ',
        timestamp: new Date().toISOString(),
        pending: true
      });

      toast({
        title: "Mode Updated",
        description: "Device mode command sent successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update mode.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deviceModes = [
    { value: 0, name: 'Wake' },
    { value: 1, name: 'Display Off' },
    { value: 2, name: 'Deep Sleep' },
    { value: 3, name: 'Lock' },
    { value: 4, name: 'Unlock' },
    { value: 5, name: 'EPS Mode' }
  ];

  const callModes = [
    { value: 0, name: 'Silent' },
    { value: 1, name: 'Vibrate Only' },
    { value: 2, name: 'Ring + Vibrate' }
  ];

  const DScallModes = [
    { value: 0, name: 'Auto Decline' },
    { value: 1, name: 'Auto Accept' },
    { value: 2, name: 'Vibrate Only' },
    { value: 3, name: 'Ring + Vibrate' }
  ];

  const gpsModes = [
    { value: 0, name: 'GPS OFF' },
    { value: 1, name: 'GPS ON' },
    { value: 2, name: 'Sleep 5s' },
    { value: 3, name: 'Sleep 15s' },
    { value: 4, name: 'Sleep 30s' },
    { value: 5, name: 'Sleep 60s' },
    { value: 6, name: 'Sleep 80s' },
    { value: 7, name: 'Sleep 120s' },
    { value: 8, name: 'Sleep 180s' },
    { value: 9, name: 'Sleep 300s' }
  ];

  const ringtones = [
    { value: 0, name: 'Around the world' },
    { value: 1, name: 'Blue' },
    { value: 2, name: 'Careless Whisper' },
    { value: 3, name: 'James Bond' },
    { value: 4, name: 'Packman' },
    { value: 5, name: 'Better Alone' },
    { value: 6, name: 'Mario' },
    { value: 7, name: 'Doom' },
    { value: 8, name: 'GimmeGimmeGimme' },
    { value: 9, name: 'Misson Impossible' },
    { value: 10, name: 'Friends' },
    { value: 11, name: '20th Century Fox' },
    { value: 12, name: 'Uptown Girl' },
    { value: 13, name: 'Pink Panther' },
    { value: 14, name: 'Tom and Jerry' },
    { value: 15, name: 'Starwars 1' },
    { value: 16, name: 'Starwars 2' },
    { value: 17, name: 'Starwars 3' },
    { value: 18, name: 'Starwars 4' },
    { value: 19, name: 'Nokia 1' },
    { value: 20, name: 'Nokia 2' },
    { value: 21, name: 'Nokia 3' },
    { value: 22, name: 'Nokia 4' },
    { value: 23, name: 'Final Countdown' },
    { value: 24, name: 'Axel F' }
  ];

  return (
    <div className="p-6 pt-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Device Settings</h1>
        <div className="flex gap-2">
          <Button
            onClick={resetToDefaults}
            variant="outline"
            size="sm"
            className={`
              group
              border-amber-500/70 text-amber-400
              hover:border-amber-500 hover:bg-amber-500/10 hover:text-amber-300
              active:bg-amber-500/20 active:scale-[0.98]
              focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-gray-950
              transition-all duration-200 ease-out
              disabled:opacity-50
            `}
          >
            <RotateCcw className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:rotate-[-90deg]" />
            Reset
          </Button>
          <Button
            onClick={saveSettings}
            disabled={loading}
            className={`
              relative group
              bg-gradient-to-r from-emerald-500 to-green-600
              text-white font-semibold
              px-5 py-2.5
              rounded-lg
              shadow-md hover:shadow-lg hover:from-emerald-600 hover:to-green-700
              focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-gray-950
              active:scale-95 active:shadow-inner active:from-emerald-600 active:to-green-700
              transition-all duration-300 ease-out
              disabled:opacity-60 disabled:cursor-not-allowed
            `}
          >
            <span className="relative z-10 flex items-center justify-center">
              {loading ? (
                <>
                  <div className="flex items-center justify-center space-x-1 mr-2.5">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"></div>
                  </div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2 transform transition-transform duration-200 group-hover:scale-110" />
                  Save Settings
                </>
              )}
            </span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Settings className="w-5 h-5 mr-2 text-blue-400" />
              General Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-4 h-4 text-gray-400" />
                <span className="text-white">Boot Animation</span>
              </div>
              <Switch
                checked={settings.boot_animation}
                onCheckedChange={(checked) => updateSetting('boot_animation', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bell className="w-4 h-4 text-gray-400" />
                <span className="text-white">Boot SMS</span>
              </div>
              <Switch
                checked={settings.boot_sms}
                onCheckedChange={(checked) => updateSetting('boot_sms', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-gray-400" />
                <span className="text-white">Enable Buzzer</span>
              </div>
              <Switch
                checked={settings.enable_buzzer}
                onCheckedChange={(checked) => updateSetting('enable_buzzer', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Vibrate className="w-4 h-4 text-gray-400" />
                <span className="text-white">Enable Haptics</span>
              </div>
              <Switch
                checked={settings.enable_haptics}
                onCheckedChange={(checked) => updateSetting('enable_haptics', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MessageSquareShare className="w-4 h-4 text-gray-400" />
                <span className="text-white">Enable MQTT SMS Alerts</span>
              </div>
              <Switch
                checked={settings.sms_thru_mqtt}
                onCheckedChange={(checked) => updateSetting('sms_thru_mqtt', checked)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Ringtone</label>
              <div className="grid grid-cols-2 gap-2">
                {ringtones.map((mode) => (
                  <Button
                    key={mode.value}
                    variant={settings.ringtone === mode.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateSetting('ringtone', mode.value)}
                    className={settings.ringtone === mode.value 
                      ? "bg-blue-600 hover:bg-blue-700" 
                      : "border-gray-600 text-gray-300 hover:bg-gray-700"
                    }
                  >
                    {mode.name}
                  </Button>
                ))}
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Bell className="w-5 h-5 mr-2 text-yellow-400" />
              Notification Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-gray-400" />
                <span className="text-white">Notification Sound</span>
              </div>
              <Switch
                checked={settings.noti_sound}
                onCheckedChange={(checked) => updateSetting('noti_sound', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bell className="w-4 h-4 text-gray-400" />
                <span className="text-white">Push Notifications</span>
              </div>
              <Switch
                checked={settings.noti_ppp}
                onCheckedChange={(checked) => updateSetting('noti_ppp', checked)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Call Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {callModes.map((mode) => (
                  <Button
                    key={mode.value}
                    variant={settings.call_mode === mode.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateSetting('call_mode', mode.value)}
                    className={settings.call_mode === mode.value 
                      ? "bg-blue-600 hover:bg-blue-700" 
                      : "border-gray-600 text-gray-300 hover:bg-gray-700"
                    }
                  >
                    {mode.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Deep Sleep Call Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {DScallModes.map((mode) => (
                  <Button
                    key={mode.value}
                    variant={settings.DS_call_mode === mode.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateSetting('DS_call_mode', mode.value)}
                    className={settings.DS_call_mode === mode.value 
                      ? "bg-purple-600 hover:bg-purple-700" 
                      : "border-gray-600 text-gray-300 hover:bg-gray-700"
                    }
                  >
                    {mode.name}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Power Management */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Power className="w-5 h-5 mr-2 text-green-400" />
              Power Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Power className="w-4 h-4 text-gray-400" />
                <span className="text-white">Periodic Wakeup</span>
              </div>
              <Switch
                checked={settings.prd_wakeup}
                onCheckedChange={(checked) => updateSetting('prd_wakeup', checked)}
              />
            </div>
            {settings.prd_wakeup && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Wakeup Interval</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    value={minutesToSlider(settings.prd_wakeup_time)}
                    onChange={handleWakeupSliderChange}
                    className="w-full accent-green-500"
                    style={{ appearance: 'auto' }}
                  />
                  <p className="text-xs text-gray-500">
                    {formatWakeupTime(settings.prd_wakeup_time)}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-gray-400">SMS Location Update Interval</label>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="1"
                    value={settings.prd_sms_intvrl}
                    onChange={(e) => updateSetting('prd_sms_intvrl', parseInt(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <p className="text-xs text-gray-500">
                    {settings.prd_sms_intvrl === 0
                      ? "Do not send"
                      : settings.prd_sms_intvrl === 1
                      ? "Send everytime"
                      : `Send every ${settings.prd_sms_intvrl} wakeups${getIntervalTime(settings.prd_sms_intvrl)}`}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-gray-400">MQTT Location Update Interval</label>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="1"
                    value={settings.prd_mqtt_intvrl}
                    onChange={(e) => updateSetting('prd_mqtt_intvrl', parseInt(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                  <p className="text-xs text-gray-500">
                    {settings.prd_mqtt_intvrl === 0
                      ? "Do not send"
                      : settings.prd_mqtt_intvrl === 1
                      ? "Send everytime"
                      : `Send every ${settings.prd_mqtt_intvrl} wakeups${getIntervalTime(settings.prd_mqtt_intvrl)}`}
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm text-gray-400">GPS Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {gpsModes.map((mode) => (
                  <Button
                    key={mode.value}
                    variant={settings.gps_mode === mode.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateSetting('gps_mode', mode.value)}
                    className={settings.gps_mode === mode.value 
                      ? "bg-green-600 hover:bg-green-700" 
                      : "border-gray-600 text-gray-300 hover:bg-gray-700"
                    }
                  >
                    {mode.name}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Device Control */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Shield className="w-5 h-5 mr-2 text-red-400" />
              Device Control
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-400 mb-4">
              Quick actions to control device state
            </p>

            <div className="grid grid-cols-2 gap-3">
              {deviceModes.map((mode) => (
                <Button
                  key={mode.value}
                  variant="outline"
                  size="sm"
                  onClick={() => UpdateMode(mode.value)}
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  {mode.name}
                </Button>
              ))}
            </div>

            <div className="pt-4 border-t border-gray-700">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => UpdateMode(6)}
                  className="border-orange-600 text-orange-300 hover:bg-orange-900"
                >
                  Reboot GSM
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => UpdateMode(7)}
                  className="border-red-600 text-red-300 hover:bg-red-900"
                >
                  Reboot Device
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsTab;