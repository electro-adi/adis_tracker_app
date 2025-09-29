import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Callable, Dict, Any
import paho.mqtt.client as mqtt
from pydantic import ValidationError
from models import DeviceStatus, GpsLocation, CallStatus, DeviceSettings, LedConfig, Contacts, SmsMessage, Notification
from database import db_manager

datetime.now(timezone.utc)

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
        self.last_msg: Optional[datetime] = None
        self.lastwill_time: Optional[datetime] = None
        self.tracker_connected = False
        
        # Callback handlers
        self.status_callback: Optional[Callable] = None
        self.location_callback: Optional[Callable] = None
        self.sms_callback: Optional[Callable] = None
        self.stored_sms_callback: Optional[Callable] = None
        self.call_callback: Optional[Callable] = None
        self.led_config_callback: Optional[Callable] = None
        self.config_callback: Optional[Callable] = None
        self.contacts_callback: Optional[Callable] = None
        self.notification_callback: Optional[Callable] = None
        self.main_loop: Optional[asyncio.AbstractEventLoop] = None
        
        # Topic mappings
        self.subscribe_topics = [
            "Tracker/from/status",
            "Tracker/from/location",
            "Tracker/from/call_status",
            "Tracker/from/led_config",
            "Tracker/from/config",
            "Tracker/from/contacts",
            "Tracker/from/sms/received",
            "Tracker/from/sms/stored",
            "Tracker/from/espnow/received",
            "Tracker/from/lastwill"
        ]

    def set_event_loop(self, loop):
        self.main_loop = loop

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
        self.main_loop = asyncio.get_running_loop()
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
                for _ in range(20):  # Try for 2 seconds (20 * 0.1)
                    if self.connected:
                        break
                    await asyncio.sleep(0.1)
                
                if self.connected:
                    self.last_connected = datetime.now(timezone.utc).isoformat()
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

            if topic != "Tracker/from/lastwill":
                self.last_msg = datetime.now(timezone.utc).isoformat()

            if self.main_loop and self._on_message:
                asyncio.run_coroutine_threadsafe(db_manager.save_mqtt_status(self.last_msg), self.main_loop)

            # Route messages based on topic
            if topic == "Tracker/from/status":
                self._handle_status_message(payload)

            elif topic == "Tracker/from/location":
                self._handle_location_message(payload)

            elif topic == "Tracker/from/call_status":
                self._handle_call_message(payload)

            elif topic == "Tracker/from/led_config":
                self._handle_led_config(payload)

            elif topic == "Tracker/from/config":
                self._handle_config(payload)

            elif topic == "Tracker/from/contacts":
                self._handle_contacts(payload)

            elif topic == "Tracker/from/sms/stored":
                self._handle_sms_message(payload)

            elif topic == "Tracker/from/espnow/received":
                self._handle_espnow_message(payload)

            elif topic == "Tracker/from/lastwill":
                self._handle_lastwill()

        except Exception as e:
            logger.error(f"Error processing MQTT message: {str(e)}")

    def _handle_status_message(self, payload: str):
        """Handle device status updates"""
        try:
            data = json.loads(payload)
            status = DeviceStatus(**data)

            if self.main_loop and self.status_callback:
                asyncio.run_coroutine_threadsafe(self.status_callback(status), self.main_loop)

            reason_map = {
                (0, 1): "Device is online",
                (2, 3): "Device woken up",
                (4,): "Periodic Wake up"
            }

            reason_message = "Unknown status"

            for keys, msg in reason_map.items():
                if status.send_reason in keys:
                    reason_message = msg
                    break

            notification = Notification(
                title="Device Status Updated",
                message=f"{reason_message} - Battery: {status.bat_percent}%",
                type="status",
                data=data
            )
                
            if self.main_loop and self.notification_callback:
                asyncio.run_coroutine_threadsafe(self.notification_callback(notification), self.main_loop)
                    
        except (json.JSONDecodeError, ValidationError) as e:
            logger.error(f"Error parsing status message: {str(e)}")

    def _handle_location_message(self, payload: str):
        """Handle GPS location updates"""
        try:
            data = json.loads(payload)
            location = GpsLocation(**data)

            location.gps_lat

            if location.gps_lat and location.gps_lon:
                location.gps_age = datetime.now(timezone.utc)

            if location.lbs_lat and location.lbs_lon:
                location.lbs_age = datetime.now(timezone.utc)
            
            if self.main_loop and self.location_callback:
                asyncio.run_coroutine_threadsafe(self.location_callback(location), self.main_loop)
                
            # Create notification
            notification = Notification(
                title="Location Updated",
                message=f"New GPS coordinates: {location.gps_lat:.6f}, {location.gps_lon:.6f}",
                type="location",
                data=data
            )

            if self.main_loop and self.notification_callback:
                asyncio.run_coroutine_threadsafe(self.notification_callback(notification), self.main_loop)
                
                
        except (json.JSONDecodeError, ValidationError) as e:
            logger.error(f"Error parsing location message: {str(e)}")

    def _handle_call_message(self, payload: str):
        """Handle incoming call notifications"""
        try:
            data = json.loads(payload)
            callstatus = CallStatus(**data)
            caller_number = callstatus.number or "Unknown"

            if callstatus.status == 0:
                logger.info(f"Call disconnected")

            elif callstatus.status == 2:
                logger.info(f"Incoming call: {caller_number}")

                if self.main_loop and self.call_callback:
                    asyncio.run_coroutine_threadsafe(self.call_callback(caller_number), self.main_loop)
                
                # Create notification
                notification = Notification(
                    title="Incoming Call",
                    message=f"Device receiving call from: {caller_number}",
                    type="call",
                    data={"caller": caller_number}
                )

                if self.main_loop and self.notification_callback:
                    asyncio.run_coroutine_threadsafe(self.notification_callback(notification), self.main_loop)

            elif callstatus.status == 3:
                logger.info(f"Call Connected: {caller_number}")

        except Exception as e:
            logger.error(f"Error processing call message: {str(e)}")

    def _handle_led_config(self, payload: str):
        """Handle led config"""
        try:
            data = json.loads(payload)
            led_config = LedConfig(**data)

            if self.main_loop and self.led_config_callback:
                asyncio.run_coroutine_threadsafe(self.led_config_callback(led_config), self.main_loop)
           
        except (json.JSONDecodeError, ValidationError) as e:
            logger.error(f"Error parsing status message: {str(e)}")

    def _handle_config(self, payload: str):
        """Handle led config"""
        try:
            data = json.loads(payload)
            config =  DeviceSettings(**data)

            if self.main_loop and self.config_callback:
                asyncio.run_coroutine_threadsafe(self.config_callback(config), self.main_loop)
           
        except (json.JSONDecodeError, ValidationError) as e:
            logger.error(f"Error parsing status message: {str(e)}")

    def _handle_contacts(self, payload: str):
        """Handle contacts"""
        try:
            data = json.loads(payload)
            contacts =  Contacts(**data)

            if self.main_loop and self.contacts_callback:
                asyncio.run_coroutine_threadsafe(self.contacts_callback(contacts), self.main_loop)
           
        except (json.JSONDecodeError, ValidationError) as e:
            logger.error(f"Error parsing status message: {str(e)}")

    def _handle_sms_message(self, payload: str):
        """Handle stored SMS messages"""
        try:
            data = json.loads(payload)
            sms = SmsMessage(**data)

            if self.main_loop and self.sms_callback:
                asyncio.run_coroutine_threadsafe(self.sms_callback(sms), self.main_loop)
                
        except (json.JSONDecodeError, ValidationError) as e:
            logger.error(f"Error parsing SMS message: {str(e)}")

    def _handle_espnow_message(self, payload: str):
        """Handle ESP-NOW messages"""
        try:
            notification = Notification(
                title="ESP-NOW Message",
                message=f"Received: {payload}",
                type="notification",
                data={"espnow_message": payload}
            )
            
            if self.main_loop and self.notification_callback:
                asyncio.run_coroutine_threadsafe(self.notification_callback(notification), self.main_loop)
                
        except Exception as e:
            logger.error(f"Error processing ESP-NOW message: {str(e)}")

    def _handle_lastwill(self):
        """Handle MQTT Last Will"""
        try:
            notification = Notification(
                title="Tracker Connnection Lost",
                type="notification",
            )
            
            if self.main_loop and self.notification_callback:
                asyncio.run_coroutine_threadsafe(self.notification_callback(notification), self.main_loop)
                
        except Exception as e:
            logger.error(f"Error processing Lastwill message: {str(e)}")

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
        return await self.publish_command("Tracker/to/mode", str(mode))

    async def get_device_status(self) -> bool:
        """Request device status"""
        return await self.publish_command("Tracker/to/request", "0")

    async def get_device_location(self) -> bool:
        """Request device location"""
        return await self.publish_command("Tracker/to/request", "1")
    
    async def get_device_callstatus(self) -> bool:
        """Request device callstatus"""
        return await self.publish_command("Tracker/to/request", "2")

    async def get_led_config(self) -> bool:
        """Get led configuration"""
        return await self.publish_command("Tracker/to/request", "3")

    async def set_led_config(self, led_config: dict) -> bool:
        """Set LED configuration"""
        return await self.publish_command("Tracker/to/set/led_config", led_config)

    async def get_device_config(self) -> bool:
        """Get device configuration"""
        return await self.publish_command("Tracker/to/request", "4")

    async def set_device_config(self, config: dict) -> bool:
        """Set device configuration"""
        return await self.publish_command("Tracker/to/set/config", config)

    async def get_contacts(self) -> bool:
        """Get contacts"""
        return await self.publish_command("Tracker/to/request", "5")
    
    async def set_contacts(self, contacts: dict) -> bool:
        """Set contacts"""
        return await self.publish_command("Tracker/to/set/contacts", contacts)

    async def make_call(self, number: str) -> bool:
        """Make device call a number"""
        return await self.publish_command("Tracker/to/call", number)

    async def send_sms(self, sms_data: dict) -> bool:
        """Send SMS via device"""
        return await self.publish_command("Tracker/to/sms/send", sms_data)
    
    async def get_sms(self, index: int) -> bool:
        """Get stored sms"""
        return await self.publish_command("Tracker/to/sms/get", str(index))

    async def control_buzzer(self, enabled: bool) -> bool:
        """Control device buzzer"""
        return await self.publish_command("Tracker/to/scream", enabled)

    async def control_vibrator(self, enabled: bool) -> bool:
        """Control device vibrator"""
        return await self.publish_command("Tracker/to/vibrate", enabled)

    async def send_ir_cmd(self, cmd: int) -> bool:
        """Send IR CMD (0-4)"""
        return await self.publish_command("Tracker/to/irsend", str(cmd))

    async def app_offline(self) -> bool:
        """Tell Tracker that app is offline"""
        return await self.publish_command("Tracker/to/app_offline", "1")

    def set_callbacks(self, status_cb=None, location_cb=None, sms_cb=None, call_cb=None, 
                      led_config_cb=None, config_cb=None, contacts_cb=None, notification_cb=None):
        """Set callback functions for handling device messages"""
        self.status_callback = status_cb
        self.location_callback = location_cb
        self.sms_callback = sms_cb
        self.call_callback = call_cb
        self.led_config_callback = led_config_cb
        self.config_callback = config_cb
        self.contacts_callback = contacts_cb
        self.notification_callback = notification_cb

    def get_status(self) -> dict:
        """Get current MQTT connection status"""
        return {
            "connected": self.connected,
            "broker": self.broker,
            "port": self.port,
            "last_connected": self.last_connected,
            "last_msg": self.last_msg,
            "connection_attempts": self.connection_attempts,
            "lastwill_time": self.lastwill_time,
            "tracker_connected": self.tracker_connected
        }
    