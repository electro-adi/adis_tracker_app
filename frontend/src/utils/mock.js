// Mock data for GPS tracker app
export const mockDeviceStatus = {
  "message": "Online",
  "screen_on": false,
  "last_activity": 76,
  "bat_voltage": 4.26,
  "bat_percent": 100,
  "4g_rssi": 20,
  "wifi_enabled": false,
  "wifi_rssi": 0,
  "wifi": "",
  "in_call": false,
  "locked": false,
  "buzzer": false,
  "vibrator": false,
  "light_level": 241,
  "stored_lat": 10.0214584,
  "stored_lon": 76.2938079,
  "uptime": "14:39:44 30/7/25",
  "espnow_state": 0,
  "callmode": 2,
  "gpsmode": 0,
  "bootanimation": true,
  "enablebuzzer": true,
  "enablehaptics": true,
  "enableled": true,
  "bootsms": false,
  "noti_sound": true,
  "noti_ppp": true,
  "ringtone": 19,
  "prd_wakeup": false,
  "prd_wakeup_time": 300000,
  "DS_call_mode": 3,
  "led_boot_ani": 4,
  "led_call_ani": 6,
  "led_noti_ani": 5,
  "red": 0,
  "green": 0,
  "blue": 0
};

export const mockGpsData = {
  "lat": 19.123456,
  "lon": 72.123456,
  "lbs_lat": 19.123456,
  "lbs_lon": 72.123456,
  "sats": 7,
  "lbs_age": "39m",
  "gps_age": "39m",
  "alt": 10.5,
  "speed": 0.0,
  "course": 0.0
};

export const mockContacts = [
  { id: 1, name: "Emergency", number: "911" },
  { id: 2, name: "Home", number: "1234567890" },
  { id: 3, name: "Office", number: "0987654321" }
];

export const mockSmsHistory = [
  { id: 1, number: "1234567890", message: "Device status sent", timestamp: "2025-01-15 14:30:22", type: "sent" },
  { id: 2, number: "0987654321", message: "Location request received", timestamp: "2025-01-15 14:25:15", type: "received" }
];

// Mock API functions
export const mockApi = {
  getDeviceStatus: () => Promise.resolve(mockDeviceStatus),
  getLocation: () => Promise.resolve(mockGpsData),
  getContacts: () => Promise.resolve(mockContacts),
  sendSms: (data) => {
    console.log('Mock SMS sent:', data);
    return Promise.resolve({ success: true, message: 'SMS sent successfully' });
  },
  makeCall: (number) => {
    console.log('Mock call initiated to:', number);
    return Promise.resolve({ success: true, message: 'Call initiated' });
  },
  updateSettings: (settings) => {
    console.log('Mock settings updated:', settings);
    return Promise.resolve({ success: true, message: 'Settings updated' });
  },
  updateLed: (ledData) => {
    console.log('Mock LED updated:', ledData);
    return Promise.resolve({ success: true, message: 'LED updated' });
  },
  setMode: (mode) => {
    console.log('Mock mode set:', mode);
    return Promise.resolve({ success: true, message: 'Mode set' });
  }
};