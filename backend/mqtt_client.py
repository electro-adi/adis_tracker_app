import asyncio
import json
import logging
from datetime import datetime
from typing import Optional, Callable, Dict, Any
import paho.mqtt.client as mqtt
from pydantic import ValidationError
from models import DeviceStatus, GpsLocation, SmsMessage, Notification

def run_async_task(coro):
    """Safely run coroutine from any thread by forwarding it to the main loop."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        # We're not in the main thread, get main thread loop
        loop = asyncio.get_event_loop()
    loop.call_soon_threadsafe(asyncio.create_task, coro)

logger = logging.getLogger(__name__)

class MQTTManager:
    def __init__(self, broker: str, port: int, username: str, password: str):
        self.broker = broker
        self.port = port
        self.username = username
        self.password = password
        self.client: Optional[mqtt.Client] = None
        self.connected = False
        self.connection_attempts = 0
        self.last_connected: Optional[datetime] = None
        
        # Callback handlers
        self.status_callback: Optional[Callable] = None
        self.location_callback: Optional[Callable] = None
        self.sms_callback: Optional[Callable] = None
        self.call_callback: Optional[Callable] = None
        self.notification_callback: Optional[Callable] = None
        
        # Topic mappings
        self.subscribe_topics = [
            "Tracker/status",
            "Tracker/location", 
            "Tracker/ringing",
            "Tracker/sms/received",
            "Tracker/espnow/received",
            "Tracker/contacts"
        ]

    def setup_client(self):
        """Setup MQTT client with callbacks"""
        self.client = mqtt.Client(client_id="gps_tracker_app", protocol=mqtt.MQTTv311)
        self.client.username_pw_set(self.username, self.password)
        
        # Set callbacks
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message
        self.client.on_subscribe = self._on_subscribe
        self.client.on_publish = self._on_publish
        
        # Configure TLS for secure connection
        self.client.tls_set()

    async def connect(self) -> bool:
        """Connect to MQTT broker"""
        if not self.client:
            self.setup_client()
            
        try:
            self.connection_attempts += 1
            logger.info(f"Attempting MQTT connection to {self.broker}:{self.port}")
            
            # Connect with keepalive
            result = self.client.connect(self.broker, self.port, keepalive=60)
            if result == mqtt.MQTT_ERR_SUCCESS:
                # Start the network loop in a separate thread
                self.client.loop_start()
                
                # Wait for connection callback
                await asyncio.sleep(2)
                
                if self.connected:
                    self.last_connected = datetime.utcnow()
                    logger.info("MQTT connection established successfully")
                    return True
                    
            logger.error(f"MQTT connection failed with result code: {result}")
            return False
            
        except Exception as e:
            logger.error(f"MQTT connection error: {str(e)}")
            return False

    def disconnect(self):
        """Disconnect from MQTT broker"""
        if self.client and self.connected:
            self.client.loop_stop()
            self.client.disconnect()
            self.connected = False
            logger.info("Disconnected from MQTT broker")

    def _on_connect(self, client, userdata, flags, rc):
        """Callback for successful connection"""
        if rc == 0:
            self.connected = True
            logger.info("Connected to MQTT broker with result code 0")
            
            # Subscribe to all tracker topics
            for topic in self.subscribe_topics:
                client.subscribe(topic, qos=1)
                logger.info(f"Subscribed to topic: {topic}")
        else:
            logger.error(f"Failed to connect to MQTT broker with result code {rc}")

    def _on_disconnect(self, client, userdata, rc):
        """Callback for disconnection"""
        self.connected = False
        if rc != 0:
            logger.warning(f"Unexpected MQTT disconnection with code {rc}")
        else:
            logger.info("MQTT client disconnected")

    def _on_subscribe(self, client, userdata, mid, granted_qos):
        """Callback for successful subscription"""
        logger.info(f"Subscribed successfully with QoS: {granted_qos}")

    def _on_publish(self, client, userdata, mid):
        """Callback for successful publish"""
        logger.debug(f"Message published with mid: {mid}")

    def _on_message(self, client, userdata, msg):
        """Handle incoming MQTT messages"""
        try:
            topic = msg.topic
            payload = msg.payload.decode('utf-8')
            logger.info(f"Received message on topic {topic}: {payload}")
            
            # Route messages based on topic
            if topic == "Tracker/status":
                self._handle_status_message(payload)
            elif topic == "Tracker/location":
                self._handle_location_message(payload)
            elif topic == "Tracker/ringing":
                self._handle_call_message(payload)
            elif topic == "Tracker/sms/received":
                self._handle_sms_message(payload)
            elif topic == "Tracker/espnow/received":
                self._handle_espnow_message(payload)
            elif topic == "Tracker/contacts":
                self._handle_contacts_message(payload)
                
        except Exception as e:
            logger.error(f"Error processing MQTT message: {str(e)}")

    def _handle_status_message(self, payload: str):
        """Handle device status updates"""
        try:
            data = json.loads(payload)
            status = DeviceStatus(**data)
            
            if self.status_callback:
                run_async_task(self.status_callback(status))
                
            # Create notification
            notification = Notification(
                title="Device Status Updated",
                message=f"Device is {status.message.lower()} - Battery: {status.bat_percent}%",
                type="status",
                data=data
            )
            
            if self.notification_callback:
                run_async_task(self.notification_callback(notification))
                
        except (json.JSONDecodeError, ValidationError) as e:
            logger.error(f"Error parsing status message: {str(e)}")

    def _handle_location_message(self, payload: str):
        """Handle GPS location updates"""
        try:
            data = json.loads(payload)
            location = GpsLocation(**data)
            
            if self.location_callback:
                run_async_task(self.location_callback(location))
                
            # Create notification
            notification = Notification(
                title="Location Updated",
                message=f"New GPS coordinates: {location.lat:.6f}, {location.lon:.6f}",
                type="location",
                data=data
            )
            
            if self.notification_callback:
                run_async_task(self.notification_callback(notification))
                
        except (json.JSONDecodeError, ValidationError) as e:
            logger.error(f"Error parsing location message: {str(e)}")

    def _handle_call_message(self, payload: str):
        """Handle incoming call notifications"""
        try:
            caller_number = payload.strip()
            
            if self.call_callback:
                run_async_task(self.call_callback(caller_number))
                
            # Create notification
            notification = Notification(
                title="Incoming Call",
                message=f"Device receiving call from: {caller_number}",
                type="call",
                data={"caller": caller_number}
            )
            
            if self.notification_callback:
                run_async_task(self.notification_callback(notification))
                
        except Exception as e:
            logger.error(f"Error processing call message: {str(e)}")

    def _handle_sms_message(self, payload: str):
        """Handle received SMS messages"""
        try:
            data = json.loads(payload)
            sms = SmsMessage(
                number=data.get("number", ""),
                message=data.get("sms", ""),
                type="received"
            )
            
            if self.sms_callback:
                run_async_task(self.sms_callback(sms))
                
            # Create notification
            notification = Notification(
                title="SMS Received",
                message=f"From {sms.number}: {sms.message[:50]}...",
                type="sms",
                data=data
            )
            
            if self.notification_callback:
                run_async_task(self.notification_callback(notification))
                
        except (json.JSONDecodeError, ValidationError) as e:
            logger.error(f"Error parsing SMS message: {str(e)}")

    def _handle_espnow_message(self, payload: str):
        """Handle ESP-NOW messages"""
        try:
            notification = Notification(
                title="ESP-NOW Message",
                message=f"Received: {payload}",
                type="system",
                data={"espnow_message": payload}
            )
            
            if self.notification_callback:
                run_async_task(self.notification_callback(notification))
                
        except Exception as e:
            logger.error(f"Error processing ESP-NOW message: {str(e)}")

    def _handle_contacts_message(self, payload: str):
        """Handle contacts data from device"""
        try:
            data = json.loads(payload)
            logger.info(f"Received contacts data: {data}")
            
            # This could be used to sync contacts with device
            # Implementation depends on the exact format from device
            
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing contacts message: {str(e)}")

    async def publish_command(self, topic: str, payload: Any) -> bool:
        """Publish command to device"""
        if not self.connected or not self.client:
            logger.error("MQTT client not connected")
            return False
            
        try:
            if isinstance(payload, (dict, list)):
                payload = json.dumps(payload)
            elif not isinstance(payload, str):
                payload = str(payload)
                
            result = self.client.publish(topic, payload, qos=1)
            
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                logger.info(f"Published to {topic}: {payload}")
                return True
            else:
                logger.error(f"Failed to publish to {topic}: {result.rc}")
                return False
                
        except Exception as e:
            logger.error(f"Error publishing to {topic}: {str(e)}")
            return False

    # Device control methods
    async def set_device_mode(self, mode: int) -> bool:
        """Set device mode (0-7)"""
        return await self.publish_command("Tracker/mode", str(mode))

    async def get_device_status(self) -> bool:
        """Request device status"""
        return await self.publish_command("Tracker/get_status", "")

    async def get_device_location(self) -> bool:
        """Request device location"""
        return await self.publish_command("Tracker/get_location", "")

    async def set_led_config(self, config: dict) -> bool:
        """Set LED configuration"""
        return await self.publish_command("Tracker/set_led", config)

    async def set_device_config(self, config: dict) -> bool:
        """Set device configuration"""
        return await self.publish_command("Tracker/set_config", config)

    async def make_call(self, number: str) -> bool:
        """Make device call a number"""
        return await self.publish_command("Tracker/call", number)

    async def send_sms(self, sms_data: dict) -> bool:
        """Send SMS via device"""
        return await self.publish_command("Tracker/sms/send", sms_data)

    async def control_buzzer(self, enabled: bool) -> bool:
        """Control device buzzer"""
        return await self.publish_command("Tracker/scream", enabled)

    async def control_vibrator(self, enabled: bool) -> bool:
        """Control device vibrator"""
        return await self.publish_command("Tracker/vibrate", enabled)

    def set_callbacks(self, status_cb=None, location_cb=None, sms_cb=None, 
                     call_cb=None, notification_cb=None):
        """Set callback functions for handling device messages"""
        self.status_callback = status_cb
        self.location_callback = location_cb
        self.sms_callback = sms_cb
        self.call_callback = call_cb
        self.notification_callback = notification_cb

    def get_status(self) -> dict:
        """Get current MQTT connection status"""
        return {
            "connected": self.connected,
            "broker": self.broker,
            "port": self.port,
            "last_connected": self.last_connected,
            "connection_attempts": self.connection_attempts
        }