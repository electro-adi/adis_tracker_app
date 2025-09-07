import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Badge } from './ui/badge';
import { Lightbulb, Palette, Settings, Eye } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LedTab = () => {
  const [ledSettings, setLedSettings] = useState({
    red: 0,
    green: 0,
    blue: 0,
    enableled: true
  });
  const [animationSettings, setAnimationSettings] = useState({
    led_boot_ani: 4,
    led_call_ani: 6,
    led_noti_ani: 5
  });
  const [loading, setLoading] = useState(false);
  const [previewColor, setPreviewColor] = useState('#000000');
  const { toast } = useToast();

  useEffect(() => {
    const handler = (e) => {
      const newData = e.detail;

      setLedSettings({
        red: newData.red ?? 0,
        green: newData.green ?? 0,
        blue: newData.blue ?? 0,
        enableled: newData.enableled ?? true,
      });

      setAnimationSettings({
        led_boot_ani: newData.led_boot_ani ?? 4,
        led_call_ani: newData.led_call_ani ?? 6,
        led_noti_ani: newData.led_noti_ani ?? 5,
      });
    };

    window.addEventListener("led_config_update", handler);
    return () => window.removeEventListener("led_config_update", handler);
  }, []);

  useEffect(() => {
    loadDeviceStatus();
  }, []);

  const loadDeviceStatus = async () => {
    try {
      const response = await fetch(`${API}/device/get_led_config`);
      if (response.ok) {
        const data = await response.json();
        if (data.red !== undefined) {
          setLedSettings({
            red: data.red || 0,
            green: data.green || 0,
            blue: data.blue || 0,
            enableled: data.enableled || true
          });
          setAnimationSettings({
            led_boot_ani: data.led_boot_ani || 4,
            led_call_ani: data.led_call_ani || 6,
            led_noti_ani: data.led_noti_ani || 5
          });
          
          const hex = rgbToHex(data.red || 0, data.green || 0, data.blue || 0);
          setPreviewColor(hex);
        }
      }
    } catch (error) {
      console.error('Failed to load device status:', error);
    }
  };

  const updateLedColor = (color, value) => {
    const newSettings = { ...ledSettings, [color]: value[0] };
    setLedSettings(newSettings);
    
    // Update preview color
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
      const newSettings = { ...ledSettings, red: rgb.r, green: rgb.g, blue: rgb.b };
      setLedSettings(newSettings);
      setPreviewColor(color);
    }
  };

  const applyLedSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API}/device/led`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...ledSettings,
          ...animationSettings
        })
      });

      if (response.ok) {
        toast({
          title: "LED Settings Updated",
          description: "LED configuration has been applied to the device.",
        });
      } else {
        throw new Error('Failed to update LED settings');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update LED settings.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleLed = async () => {
    const newEnabled = !ledSettings.enableled;
    setLedSettings(prev => ({ ...prev, enableled: newEnabled }));
    try {
      const response = await fetch(`${API}/device/led`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...ledSettings,
          enableled: newEnabled,
          ...animationSettings
        })
      });

      if (response.ok) {
        toast({
          title: newEnabled ? "LED Enabled" : "LED Disabled",
          description: `LED functionality has been ${newEnabled ? 'enabled' : 'disabled'}.`,
        });
      } else {
        throw new Error('Failed to toggle LED state');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to toggle LED state.",
        variant: "destructive",
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
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">LED Control</h1>
        
        <Button
          onClick={toggleLed}
          size="sm"
          className={
            ledSettings.enableled
              ? "bg-green-600 hover:bg-green-700 text-white"
              : "bg-gray-600 hover:bg-gray-700 text-white"
          }
        >
          {ledSettings.enableled ? "Disable LED" : "Enable LED"}
        </Button>
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
                  <span className="text-sm text-gray-400">{ledSettings.red}</span>
                </div>
                <Slider
                  value={[ledSettings.red]}
                  onValueChange={(value) => updateLedColor('red', value)}
                  max={255}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-sm text-green-400">Green</label>
                  <span className="text-sm text-gray-400">{ledSettings.green}</span>
                </div>
                <Slider
                  value={[ledSettings.green]}
                  onValueChange={(value) => updateLedColor('green', value)}
                  max={255}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-sm text-blue-400">Blue</label>
                  <span className="text-sm text-gray-400">{ledSettings.blue}</span>
                </div>
                <Slider
                  value={[ledSettings.blue]}
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
                      variant={animationSettings.led_boot_ani === mode.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAnimationSettings(prev => ({ ...prev, led_boot_ani: mode.value }))}
                      className={animationSettings.led_boot_ani === mode.value 
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
                <label className="text-sm text-gray-400">Call Animation</label>
                <div className="grid grid-cols-2 gap-2">
                  {animationModes.map((mode) => (
                    <Button
                      key={mode.value}
                      variant={animationSettings.led_call_ani === mode.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAnimationSettings(prev => ({ ...prev, led_call_ani: mode.value }))}
                      className={animationSettings.led_call_ani === mode.value 
                        ? "bg-green-600 hover:bg-green-700" 
                        : "border-gray-600 text-gray-300 hover:bg-gray-700"
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
                      variant={animationSettings.led_noti_ani === mode.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAnimationSettings(prev => ({ ...prev, led_noti_ani: mode.value }))}
                      className={animationSettings.led_noti_ani === mode.value 
                        ? "bg-purple-600 hover:bg-purple-700" 
                        : "border-gray-600 text-gray-300 hover:bg-gray-700"
                      }
                    >
                      {mode.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <Button 
              onClick={applyLedSettings}
              disabled={loading || !ledSettings.enableled}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Applying...
                </>
              ) : (
                <>
                  <Lightbulb className="w-4 h-4 mr-2" />
                  Apply LED Settings
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LedTab;