import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Lightbulb, LightbulbOff, Palette, Settings, RefreshCw, Eye } from 'lucide-react';
import { useToast } from "../hooks/use-toast";
import { ref, onValue, set, update } from 'firebase/database';
import { db } from '../firebase';

const LedTab = () => {
  const [LedConfig, setLedConfig] = useState({
    red: 0,
    green: 0,
    blue: 0,
    enableled: true,
    led_boot_ani: 4,
    led_call_ani: 6,
    led_noti_ani: 5
  });
  const [loading, setLoading] = useState(false);
  const [previewColor, setPreviewColor] = useState('#000000');
  const { toast } = useToast();

  const refreshLedconfig = async () => {
    setLoading(true);
    try {
      const commandRef2 = ref(db, 'Tracker/commands');
      await set(commandRef2, {
        command: 'get_ledconfig',
        data1: ' ',
        data2: ' ',
        timestamp: new Date().toISOString(),
        pending: true
      });

      toast({
        title: "Request Sent",
        description: "Device LED configuration refresh requested."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to request LED configuration refresh.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const LedConfigRef = ref(db, 'Tracker/ledconfig');
    const unsubLedConfig = onValue(LedConfigRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setLedConfig({
          red: data.red || 0,
          green: data.green || 0,
          blue: data.blue || 0,
          enableled: data.enableled !== undefined ? data.enableled : true,
          led_boot_ani: data.led_boot_ani || 4,
          led_call_ani: data.led_call_ani || 6,
          led_noti_ani: data.led_noti_ani || 5
        });
        
        const hex = rgbToHex(data.red || 0, data.green || 0, data.blue || 0);
        setPreviewColor(hex);
      }
    });

    return () => unsubLedConfig();
  }, []);

  const updateLedColor = (color, value) => {
    const newSettings = { ...LedConfig, [color]: value[0] };
    setLedConfig(newSettings);
    
    const hex = rgbToHex(newSettings.red, newSettings.green, newSettings.blue);
    setPreviewColor(hex);
  };

  const rgbToHex = (r, g, b) => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  };

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  const setPresetColor = (color) => {
    const rgb = hexToRgb(color);
    if (rgb) {
      const newSettings = { ...LedConfig, red: rgb.r, green: rgb.g, blue: rgb.b };
      setLedConfig(newSettings);
      setPreviewColor(color);
    }
  };

  const applyLedConfig = async () => {
    setLoading(true);
    try {
      const LedConfigRef = ref(db, 'Tracker/ledconfig');
      await update(LedConfigRef, {
        ...LedConfig,
        timestamp: new Date().toISOString()
      });

      const commandRef = ref(db, 'Tracker/commands');
      await set(commandRef, {
        command: 'set_ledconfig',
        data1: ' ',
        data2: ' ',
        timestamp: new Date().toISOString(),
        pending: true
      });

      toast({
        title: "LED Settings Updated",
        description: "LED configuration has been applied to the device."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update LED settings.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleLed = async () => {
    const newEnabled = !LedConfig.enableled;
    setLedConfig(prev => ({ ...prev, enableled: newEnabled }));
    try {
      const LedConfigRef = ref(db, 'Tracker/ledconfig');
      await update(LedConfigRef, {
        enableled: newEnabled,
        ...LedConfig,
        timestamp: new Date().toISOString()
      });

      const commandRef = ref(db, 'Tracker/commands');
      await set(commandRef, {
        command: 'set_ledconfig',
        data1: ' ',
        data2: ' ',
        timestamp: new Date().toISOString(),
        pending: true
      });

      toast({
        title: newEnabled ? "LED Enabled" : "LED Disabled",
        description: `LED functionality has been ${newEnabled ? 'enabled' : 'disabled'}.`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to toggle LED state.",
        variant: "destructive"
      });
    }
  };

  const presetColors = [
    { name: 'Red', color: '#FF0000' },
    { name: 'Green', color: '#00FF00' },
    { name: 'Blue', color: '#0000FF' },
    { name: 'Yellow', color: '#FFFF00' },
    { name: 'Purple', color: '#FF00FF' },
    { name: 'Cyan', color: '#00FFFF' },
    { name: 'White', color: '#FFFFFF' },
    { name: 'Orange', color: '#FF8000' }
  ];

  const animationModes = [
    { value: 0, name: 'Off' },
    { value: 1, name: 'Breathe' },
    { value: 2, name: 'Blink' },
    { value: 3, name: 'Color Wipe' },
    { value: 4, name: 'Rainbow' },
    { value: 5, name: 'Strobe' },
    { value: 6, name: 'Flicker' },
    { value: 7, name: 'Heartbeat' },
    { value: 8, name: 'Color Chase' },
    { value: 9, name: 'Fire' },
    { value: 10, name: 'Police' }
  ];

  return (
    <div className="px-[6vw] py-[5vh] space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">LED Control</h1>
        <div className="flex gap-2">
          <Button
            onClick={toggleLed}
            className={
              LedConfig.enableled
                ? "bg-gradient-to-br from-sky-500 to-blue-700 text-white"
                : "bg-gray-500 hover:bg-gray-700 text-white"
            }
          >
            {LedConfig.enableled ? <Lightbulb className="w-4 h-4 mr-2" /> : <LightbulbOff className="w-4 h-4 mr-2" />}
            {LedConfig.enableled ? "Disable LED" : "Enable LED"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Color Control */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Palette className="w-5 h-5 mr-2 text-pink-400" />
              Color Control
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Color Preview */}
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Eye className="w-4 h-4 mr-2 text-gray-400" />
                <span className="text-sm text-gray-400">Preview</span>
              </div>
              <div 
                className="w-20 h-20 rounded-full mx-auto border-2 border-gray-600 shadow-lg"
                style={{ backgroundColor: previewColor }}
              ></div>
              <p className="text-gray-400 text-sm mt-2 font-mono">{previewColor}</p>
            </div>

            {/* RGB Sliders */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-sm text-red-400">Red</label>
                  <span className="text-sm text-gray-400">{LedConfig.red}</span>
                </div>
                <Slider
                  value={[LedConfig.red]}
                  onValueChange={(value) => updateLedColor('red', value)}
                  max={255}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-sm text-green-400">Green</label>
                  <span className="text-sm text-gray-400">{LedConfig.green}</span>
                </div>
                <Slider
                  value={[LedConfig.green]}
                  onValueChange={(value) => updateLedColor('green', value)}
                  max={255}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-sm text-blue-400">Blue</label>
                  <span className="text-sm text-gray-400">{LedConfig.blue}</span>
                </div>
                <Slider
                  value={[LedConfig.blue]}
                  onValueChange={(value) => updateLedColor('blue', value)}
                  max={255}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>

            {/* Preset Colors */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Preset Colors</label>
              <div className="grid grid-cols-4 gap-2">
                {presetColors.map((preset) => (
                  <Button
                    key={preset.name}
                    variant="outline"
                    size="sm"
                    onClick={() => setPresetColor(preset.color)}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700 p-2 h-auto"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div 
                        className="w-6 h-6 rounded-full border border-gray-500"
                        style={{ backgroundColor: preset.color }}
                      ></div>
                      <span className="text-xs">{preset.name}</span>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
            <Button 
              onClick={applyLedConfig}
              disabled={loading || !LedConfig.enableled}
              className="w-full bg-gradient-to-br from-sky-500 to-blue-700 hover:from-sky-500 hover:to-blue-700 text-white"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating...
                </>
              ) : (
                <>
                  <Lightbulb className="w-4 h-4 mr-2" />
                  Update LED Color
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Animation Settings */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Settings className="w-5 h-5 mr-2 text-cyan-400" />
              Animation Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Boot Animation</label>
                <div className="grid grid-cols-2 gap-2">
                  {animationModes.map((mode) => (
                    <Button
                      key={mode.value}
                      variant={LedConfig.led_boot_ani === mode.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAnimationSettings(prev => ({ ...prev, led_boot_ani: mode.value }))}
                      className={LedConfig.led_boot_ani === mode.value 
                        ? "bg-gradient-to-br from-sky-500 to-blue-700 hover:from-sky-500 hover:to-blue-700" 
                        : "border-gray-500 text-gray-300 hover:bg-gray-700"
                      }
                    >
                      {mode.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-400">Call Animation</label>
                <div className="grid grid-cols-2 gap-2">
                  {animationModes.map((mode) => (
                    <Button
                      key={mode.value}
                      variant={LedConfig.led_call_ani === mode.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAnimationSettings(prev => ({ ...prev, led_call_ani: mode.value }))}
                      className={LedConfig.led_call_ani === mode.value 
                        ? "bg-gradient-to-r from-emerald-500 to-green-700 hover:from-emerald-500 hover:to-green-700" 
                        : "border-gray-500 text-gray-300 hover:bg-gray-700"
                      }
                    >
                      {mode.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-400">Notification Animation</label>
                <div className="grid grid-cols-2 gap-2">
                  {animationModes.map((mode) => (
                    <Button
                      key={mode.value}
                      variant={LedConfig.led_noti_ani === mode.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAnimationSettings(prev => ({ ...prev, led_noti_ani: mode.value }))}
                      className={LedConfig.led_noti_ani === mode.value 
                        ? "bg-gradient-to-br from-violet-500 to-fuchsia-700 hover:from-violet-500 hover:to-fuchsia-700" 
                        : "border-gray-500 text-gray-300 hover:bg-gray-700"
                      }
                    >
                      {mode.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <Button
                onClick={refreshLedconfig}
                disabled={loading}
                className="w-full bg-gradient-to-br from-amber-500 to-yellow-700 hover:from-amber-500 hover:to-yellow-700 text-white"
              >
                <span className="relative z-10 flex items-center justify-center">
                  {loading ? (
                    <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    </>
                  ) : (
                    <>
                    <RefreshCw className={`w-4 h-4 mr-2`} />
                    Refresh LED Config
                    </>
                  )}
                </span>
              </Button>
              <Button 
                onClick={applyLedConfig}
                disabled={loading || !LedConfig.enableled}
                className="w-full bg-gradient-to-br from-sky-500 to-blue-700 hover:from-sky-500 hover:to-blue-700 text-white"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <Lightbulb className="w-4 h-4 mr-2" />
                    Update LED Settings
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LedTab;