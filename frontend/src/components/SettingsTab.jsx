import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { 
  Settings, 
  Volume2, 
  Vibrate, 
  Bell, 
  Power, 
  RotateCcw,
  Shield,
  Smartphone,
  Wifi,
  Save
} from 'lucide-react';
import { mockApi, mockDeviceStatus } from '../utils/mock';
import { useToast } from '../hooks/use-toast';

const SettingsTab = () => {
  const [settings, setSettings] = useState({
    bootanimation: mockDeviceStatus.bootanimation,
    enablebuzzer: mockDeviceStatus.enablebuzzer,
    enablehaptics: mockDeviceStatus.enablehaptics,
    enableled: mockDeviceStatus.enableled,
    bootsms: mockDeviceStatus.bootsms,
    noti_sound: mockDeviceStatus.noti_sound,
    noti_ppp: mockDeviceStatus.noti_ppp,
    ringtone: mockDeviceStatus.ringtone,
    prd_wakeup: mockDeviceStatus.prd_wakeup,
    prd_wakeup_time: mockDeviceStatus.prd_wakeup_time,
    callmode: mockDeviceStatus.callmode,
    gpsmode: mockDeviceStatus.gpsmode,
    DS_call_mode: mockDeviceStatus.DS_call_mode
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      await mockApi.updateSettings(settings);
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
      bootanimation: true,
      enablebuzzer: true,
      enablehaptics: true,
      enableled: true,
      bootsms: false,
      noti_sound: true,
      noti_ppp: true,
      ringtone: 1,
      prd_wakeup: false,
      prd_wakeup_time: 300000,
      callmode: 2,
      gpsmode: 0,
      DS_call_mode: 3
    });
    toast({
      title: "Settings Reset",
      description: "All settings have been reset to default values.",
    });
  };

  const deviceModes = [
    { value: 0, name: 'Wake' },
    { value: 1, name: 'Display Off' },
    { value: 2, name: 'Deep Sleep' },
    { value: 3, name: 'Lock' },
    { value: 4, name: 'Unlock' },
    { value: 7, name: 'Active Mode' }
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
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Device Settings</h1>
        <div className="flex gap-2">
          <Button 
            onClick={resetToDefaults}
            variant="outline"
            size="sm"
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button 
            onClick={saveSettings}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
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
                checked={settings.bootanimation}
                onCheckedChange={(checked) => updateSetting('bootanimation', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bell className="w-4 h-4 text-gray-400" />
                <span className="text-white">Boot SMS</span>
              </div>
              <Switch
                checked={settings.bootsms}
                onCheckedChange={(checked) => updateSetting('bootsms', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-gray-400" />
                <span className="text-white">Enable Buzzer</span>
              </div>
              <Switch
                checked={settings.enablebuzzer}
                onCheckedChange={(checked) => updateSetting('enablebuzzer', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Vibrate className="w-4 h-4 text-gray-400" />
                <span className="text-white">Enable Haptics</span>
              </div>
              <Switch
                checked={settings.enablehaptics}
                onCheckedChange={(checked) => updateSetting('enablehaptics', checked)}
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
                    variant={settings.callmode === mode.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateSetting('callmode', mode.value)}
                    className={settings.callmode === mode.value 
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
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Wakeup Interval (milliseconds)</label>
                <Input
                  type="number"
                  min="60000"
                  step="1000"
                  value={settings.prd_wakeup_time}
                  onChange={(e) => updateSetting('prd_wakeup_time', parseInt(e.target.value) || 300000)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
                <p className="text-xs text-gray-500">
                  {Math.round(settings.prd_wakeup_time / 60000)} minutes
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm text-gray-400">GPS Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {gpsModes.map((mode) => (
                  <Button
                    key={mode.value}
                    variant={settings.gpsmode === mode.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateSetting('gpsmode', mode.value)}
                    className={settings.gpsmode === mode.value 
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
                  onClick={() => mockApi.setMode(mode.value)}
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
                  onClick={() => mockApi.setMode(5)}
                  className="border-orange-600 text-orange-300 hover:bg-orange-900"
                >
                  Reboot GSM
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => mockApi.setMode(6)}
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