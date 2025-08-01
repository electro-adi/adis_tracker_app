# GPS Tracker App - API Contracts & Integration Plan

## A. API Contracts

### 1. MQTT Connection Endpoints
```
POST /api/mqtt/connect - Connect to MQTT broker
GET /api/mqtt/status - Check MQTT connection status
POST /api/mqtt/disconnect - Disconnect from MQTT
```

### 2. Device Control Endpoints
```
POST /api/device/mode/{mode} - Set device mode (0-7)
GET /api/device/status - Get device status
GET /api/device/location - Get GPS location
POST /api/device/led - Set LED configuration
POST /api/device/settings - Update device settings
POST /api/device/call/{number} - Make device call number
POST /api/device/sms - Send SMS via device
POST /api/device/buzzer - Control buzzer (true/false)
POST /api/device/vibrate - Control vibrator (true/false)
```

### 3. Contact Management Endpoints
```
GET /api/contacts - Get saved contacts
POST /api/contacts - Save new contact
PUT /api/contacts/{id} - Update contact
DELETE /api/contacts/{id} - Delete contact
```

### 4. Real-time Notifications
```
WebSocket /ws/notifications - Real-time device updates
GET /api/notifications/history - Get notification history
```

## B. Mock Data to Replace

### Current Mock Data in `/frontend/src/utils/mock.js`:
- `mockDeviceStatus` → Real MQTT status data
- `mockGpsData` → Real GPS coordinates from device
- `mockContacts` → Database-stored contacts
- `mockSmsHistory` → Real SMS history from device
- `mockApi` functions → Actual API calls

### MQTT Topics Integration:
**To Tracker:**
- `Tracker/mode/` → `/api/device/mode`
- `Tracker/get_status` → `/api/device/status` 
- `Tracker/get_location` → `/api/device/location`
- `Tracker/set_led/` → `/api/device/led`
- `Tracker/set_config/` → `/api/device/settings`
- `Tracker/call/` → `/api/device/call`
- `Tracker/sms/send/` → `/api/device/sms`

**From Tracker:**
- `Tracker/status/` → WebSocket notifications
- `Tracker/location/` → WebSocket location updates
- `Tracker/ringing/` → WebSocket call notifications
- `Tracker/sms/received/` → WebSocket SMS notifications

## C. Backend Implementation Plan

### 1. MQTT Client Setup
- Connect to `ia6350c9.ala.eu-central-1.emqxsl.com:8883`
- Credentials: `admin:MQTT6282`
- QoS: 1
- Auto-reconnect functionality

### 2. Database Models
```python
# MongoDB Collections
- device_status: Current device state
- gps_locations: Location history  
- contacts: Saved phone contacts
- sms_history: SMS send/receive log
- notifications: System notifications
```

### 3. WebSocket Integration
- Real-time notifications for device updates
- Live GPS coordinate streaming
- SMS/Call event notifications
- Device status changes

### 4. Map Integration Change
- Replace Google Maps iframe with OpenStreetMap using Leaflet.js
- No API key required
- Better privacy and control

## D. Frontend & Backend Integration

### 1. Replace Mock API Calls
```javascript
// OLD: mockApi.getDeviceStatus()
// NEW: axios.get(`${API}/device/status`)

// OLD: mockApi.sendSms(data)  
// NEW: axios.post(`${API}/device/sms`, data)
```

### 2. Add Real-time Updates
```javascript
// WebSocket connection for live updates
const ws = new WebSocket(`${WS_URL}/ws/notifications`)
ws.onmessage = (event) => {
  // Handle real-time device updates
  showNotification(event.data)
}
```

### 3. Contact Management Integration
- Add contact CRUD operations in Phone tab
- Store contacts in MongoDB
- Sync with device contact storage

### 4. Notification System
- Browser push notifications
- Toast notifications for device events
- Visual/audio alerts for incoming calls/SMS

## E. Key Changes Required

### Frontend Changes:
1. Replace Google Maps with OpenStreetMap (Leaflet.js)
2. Rename "Call & SMS" to "Phone" 
3. Add contact management UI in Phone tab
4. Add WebSocket client for real-time updates
5. Add notification permission requests
6. Replace all mock API calls with real endpoints

### Backend Changes:
1. Setup MQTT client with device broker
2. Create all API endpoints listed above
3. Implement WebSocket server for real-time updates
4. Add MongoDB models for data persistence
5. Add notification system for device events

## F. Testing Strategy
1. Test MQTT connection and topic subscriptions
2. Verify all device control commands work
3. Test real-time notifications and WebSocket updates
4. Validate GPS location updates and mapping
5. Test contact management CRUD operations
6. Verify SMS/Call functionality with device