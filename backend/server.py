from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from contextlib import asynccontextmanager
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import json
import logging
import asyncio
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timezone
import humanize
import firebase_admin
from firebase_admin import messaging, credentials, exceptions


# Import our custom modules
from models import (
    DeviceStatus, GpsLocation, Contacts, SmsMessage, LedConfig, 
    DeviceSettings, Notification, MqttStatus, PushTokenRegister
)
from mqtt_client import MQTTManager
from websocket_manager import websocket_manager
from database import db_manager

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Load Firebase SDK JSON from environment variable
firebase_json_str = os.getenv("FIREBASE_ADMIN_SDK_JSON")
cred = credentials.Certificate(json.loads(firebase_json_str))

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

# Create the main app
app = FastAPI(title="GPS Tracker Control API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

mqtt_cred_str = os.getenv("MQTT_CREDENTIALS")
if not mqtt_cred_str:
    raise RuntimeError("MQTT_CREDENTIALS environment variable not set")

try:
    mqtt_cred = json.loads(mqtt_cred_str)
    broker = mqtt_cred.get("broker")
    port = int(mqtt_cred.get("port"))
    username = mqtt_cred.get("username")
    password = mqtt_cred.get("password")

    if not all([broker, port, username, password]):
        raise ValueError("MQTT_CREDENTIALS is missing required fields")
except Exception as e:
    raise RuntimeError(f"Failed to load MQTT credentials: {str(e)}")

# Initialize MQTT Manager
mqtt_manager = MQTTManager(
    broker=broker,
    port=port,
    username=username,
    password=password
)

#---------------------------------------------------------------------------  
# MQTT callback handlers
async def handle_status_update(status: DeviceStatus):
    """Handle device status updates from MQTT"""
    try:
        # Save to database
        await db_manager.save_device_status(status)

        data = json.loads(status.json())
        
        # Broadcast to WebSocket clients
        await websocket_manager.broadcast_status_update(data)
        
        logger.info("Device status updated and broadcasted")
    except Exception as e:
        logger.error(f"Error handling status update: {str(e)}")

#---------------------------------------------------------------------------  
async def handle_location_update(location: GpsLocation):
    """Handle GPS location updates from MQTT"""
    try:
        # Save to database
        await db_manager.save_gps_location(location)

        data = json.loads(location.json())
        
        # Broadcast to WebSocket clients
        await websocket_manager.broadcast_location_update(data)
        
        logger.info("GPS location updated and broadcasted")
    except Exception as e:
        logger.error(f"Error handling location update: {str(e)}")

#---------------------------------------------------------------------------  
async def handle_sms(sms: SmsMessage):
    """Handle stored SMS messages from MQTT"""
    try:
        # Save to database
        await db_manager.save_sms(sms)

        data = json.loads(sms.json())
        
        # Broadcast to WebSocket clients
        await websocket_manager.broadcast_sms_update(data)
        
        logger.info("stored SMS message broadcasted")
    except Exception as e:
        logger.error(f"Error handling stored SMS: {str(e)}")

#---------------------------------------------------------------------------  
async def handle_call_received(caller_number: str):
    """Handle incoming call notifications from MQTT"""
    try:
        # Broadcast to WebSocket clients
        await websocket_manager.broadcast_call_update(caller_number)
        
        logger.info(f"Incoming call from {caller_number} broadcasted")
    except Exception as e:
        logger.error(f"Error handling call update: {str(e)}")

#---------------------------------------------------------------------------
async def handle_led_config(led_config: LedConfig):
    """Handle device LED configuration updates from MQTT"""
    try:
        # Save to database
        await db_manager.save_led_config(led_config)

        data = json.loads(led_config.json())
        
        # Broadcast to WebSocket clients
        await websocket_manager.broadcast_led_config_update(data)

        logger.info("Device LED configuration updated and broadcasted")
    except Exception as e:
        logger.error(f"Error handling LED configuration update: {str(e)}")

#---------------------------------------------------------------------------
async def handle_config(config: DeviceSettings):
    """Handle device configuration updates from MQTT"""
    try:
        # Save to database
        await db_manager.save_device_config(config)

        data = json.loads(config.json())
        
        # Broadcast to WebSocket clients
        await websocket_manager.broadcast_config_update(data)

        logger.info("Device configuration updated and broadcasted")
    except Exception as e:
        logger.error(f"Error handling configuration update: {str(e)}")

#---------------------------------------------------------------------------
async def handle_contacts(contacts: Contacts):
    """Handle device configuration updates from MQTT"""
    try:
        # Save to database
        await db_manager.save_contacts(contacts)

        data = json.loads(contacts.json())
        
        # Broadcast to WebSocket clients
        await websocket_manager.broadcast_contacts_update(data)

        logger.info("Device configuration updated and broadcasted")
    except Exception as e:
        logger.error(f"Error handling configuration update: {str(e)}")

#---------------------------------------------------------------------------  
async def handle_notification(notification: Notification):
    """Handle system notifications from MQTT"""
    try:
        # Broadcast to WebSocket clients
        await websocket_manager.broadcast_notification(notification, user_id="user123")
        
        logger.info("Notification saved and broadcasted")
    except Exception as e:
        logger.error(f"Error handling notification: {str(e)}")

#---------------------------------------------------------------------------  
@api_router.get("/")
async def root():
    return {"message": "GPS Tracker Control API", "version": "1.0.0"}

#---------------------------------------------------------------------------  
@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "mqtt_connected": mqtt_manager.connected,
        "websocket_connections": websocket_manager.get_connection_count(),
        "database_connected": db_manager.client is not None
    }

#---------------------------------------------------------------------------  
@api_router.post("/mqtt/connect")
async def connect_mqtt():
    """Connect to MQTT broker"""
    try:
        success = await mqtt_manager.connect()
        if success:
            return {"success": True, "message": "Connected to MQTT broker"}
        else:
            raise HTTPException(status_code=500, detail="Failed to connect to MQTT broker")
    except Exception as e:
        logger.error(f"MQTT connection error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
@api_router.get("/mqtt/status", response_model=MqttStatus)
async def get_mqtt_status():
    """Get MQTT connection status"""
    status_data = mqtt_manager.get_status()

    last_msg_raw = status_data.get("last_msg")

    if isinstance(last_msg_raw, str):
        last_msg = datetime.fromisoformat(last_msg_raw)
    elif isinstance(last_msg_raw, datetime):
        last_msg = last_msg_raw
    else:
        last_msg = None

    if last_msg:
        status_data["last_msg_human"] = humanize.naturaltime(datetime.now(timezone.utc) - last_msg)
    else:
        status_data["last_msg_human"] = "--"

    return MqttStatus(**status_data)

#---------------------------------------------------------------------------  
@api_router.post("/mqtt/disconnect")
async def disconnect_mqtt():
    """Disconnect from MQTT broker"""
    try:
        mqtt_manager.disconnect()
        return {"success": True, "message": "Disconnected from MQTT broker"}
    except Exception as e:
        logger.error(f"MQTT disconnection error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
@api_router.post("/device/mode/{mode}")
async def set_device_mode(mode: int):
    """Set device mode (0-7)"""
    if mode < 0 or mode > 7:
        raise HTTPException(status_code=400, detail="Mode must be between 0 and 7")
    
    try:
        success = await mqtt_manager.set_device_mode(mode)
        if success:
            return {"success": True, "message": f"Device mode set to {mode}"}
        else:
            raise HTTPException(status_code=500, detail="Failed to set device mode")
    except Exception as e:
        logger.error(f"Error setting device mode: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
@api_router.get("/device/status")
async def get_device_status():
    """Get current device status"""
    try:
        # Request fresh status from device
        await mqtt_manager.get_device_status()
        
        # Return latest status from database
        status = await db_manager.get_latest_device_status()
        if status:

            last_activity = status.get("last_activity")

            if isinstance(last_activity, str):
                last_activity = datetime.fromisoformat(last_activity)

            if last_activity and last_activity.tzinfo is None:
                last_activity = last_activity.replace(tzinfo=timezone.utc)

            if last_activity:
                status["last_activity_human"] = humanize.naturaltime(datetime.now(timezone.utc) - last_activity)
            else:
                status["last_activity_human"] = "--"
            return status
        else:
            return {"message": "No status data available"}
    except Exception as e:
        logger.error(f"Error getting device status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------    
@api_router.get("/device/status_nomqtt")
async def get_device_status_nomqtt():
    """Get current device status without sending the mqtt message"""
    try:
        # Return latest status from database
        status = await db_manager.get_latest_device_status()
        if status:

            last_activity = status.get("last_activity")

            if isinstance(last_activity, str):
                last_activity = datetime.fromisoformat(last_activity)

            if last_activity and last_activity.tzinfo is None:
                last_activity = last_activity.replace(tzinfo=timezone.utc)

            if last_activity:
                status["last_activity_human"] = humanize.naturaltime(datetime.now(timezone.utc) - last_activity)
            else:
                status["last_activity_human"] = "--"
            return status
        else:
            return {"message": "No status data available"}
    except Exception as e:
        logger.error(f"Error getting device status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
@api_router.get("/device/location")
async def get_device_location():
    """Get current device location"""
    try:
        # Request fresh location from device
        await mqtt_manager.get_device_location()
        
        # Return latest location from database
        location = await db_manager.get_latest_gps_location()
        if location:

            # convert to datetime format from string
            gps_age = location.get("gps_age")
            lbs_age = location.get("lbs_age")

            if isinstance(gps_age, str):
                gps_age = datetime.fromisoformat(gps_age)

            if isinstance(lbs_age, str):
                lbs_age = datetime.fromisoformat(lbs_age)

            if gps_age and gps_age.tzinfo is None:
                gps_age = gps_age.replace(tzinfo=timezone.utc)

            if lbs_age and lbs_age.tzinfo is None:
                lbs_age = lbs_age.replace(tzinfo=timezone.utc)

            if gps_age:
                location["gps_age_human"] = humanize.naturaltime(datetime.now(timezone.utc) - gps_age)
            else:
                location["gps_age_human"] = "--"

            if lbs_age:
                location["lbs_age_human"] = humanize.naturaltime(datetime.now(timezone.utc) - lbs_age)
            else:
                location["lbs_age_human"] = "--"

            return location
        else:
            return {"message": "No location data available"}
    except Exception as e:
        logger.error(f"Error getting device location: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
#---------------------------------------------------------------------------  
@api_router.get("/device/location_nomqtt")
async def get_device_location_nomqtt():
    """Get current device location without sending the mqtt message"""
    try:
        # Return latest location from database
        location = await db_manager.get_latest_gps_location()
        if location:

            # convert to datetime format from string
            gps_age = location.get("gps_age")
            lbs_age = location.get("lbs_age")

            if isinstance(gps_age, str):
                gps_age = datetime.fromisoformat(gps_age)

            if isinstance(lbs_age, str):
                lbs_age = datetime.fromisoformat(lbs_age)

            if gps_age and gps_age.tzinfo is None:
                gps_age = gps_age.replace(tzinfo=timezone.utc)

            if lbs_age and lbs_age.tzinfo is None:
                lbs_age = lbs_age.replace(tzinfo=timezone.utc)

            if gps_age:
                location["gps_age_human"] = humanize.naturaltime(datetime.now(timezone.utc) - gps_age)
            else:
                location["gps_age_human"] = "--"

            if lbs_age:
                location["lbs_age_human"] = humanize.naturaltime(datetime.now(timezone.utc) - lbs_age)
            else:
                location["lbs_age_human"] = "--"

            return location
        else:
            return {"message": "No location data available"}
    except Exception as e:
        logger.error(f"Error getting device location: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
#---------------------------------------------------------------------------  
@api_router.get("/device/location_history")
async def get_device_location_history(limit: int = 100):
    """Get device location history"""
    try:
        locations = await db_manager.get_location_history(limit=limit)
        return locations
    except Exception as e:
        logger.error(f"Error getting location history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
@api_router.get("/device/get_led_config")
async def get_led_config():
    """Get LED configuration"""
    try:
        await mqtt_manager.get_led_config()

        led_config = await db_manager.get_led_config()
        if led_config:
            return led_config
        else:
            return {"message": "No led_config data available"}
    except Exception as e:
        logger.error(f"Error getting device led_config: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
@api_router.post("/device/led")
async def set_led_config(ledconfig: LedConfig):
    """Set LED configuration"""
    try:
        await db_manager.save_led_config(ledconfig)

        success = await mqtt_manager.set_led_config(json.loads(ledconfig.json(exclude_none=True)))
        if success:
            return {"success": True, "message": "LED configuration updated"}
        else:
            raise HTTPException(status_code=500, detail="Failed to update LED configuration")
    except Exception as e:
        logger.error(f"Error setting LED config: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
@api_router.get("/device/get_settings")
async def get_device_settings():
    """get device settings"""

    try:
        await mqtt_manager.get_device_config()

        settings = await db_manager.get_device_config()
        if settings:
            return settings
        else:
            return {"message": "No settings data available"}
    except Exception as e:
        logger.error(f"Error getting device settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
@api_router.post("/device/settings")
async def update_device_settings(settings: DeviceSettings):
    """Update device settings"""
    try:
        await db_manager.save_device_config(settings)

        success = await mqtt_manager.set_device_config(json.loads(settings.json(exclude_none=True)))
        if success:
            return {"success": True, "message": "Device settings updated"}
        else:
            raise HTTPException(status_code=500, detail="Failed to update device settings")
    except Exception as e:
        logger.error(f"Error updating device settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
@api_router.post("/device/get_callstatus")
async def get_device_callstatus():
    """Get device call status"""
    try:
        status = await mqtt_manager.get_device_callstatus()
        if status:
            return {"success": True, "call_status": status}
        else:
            raise HTTPException(status_code=500, detail="Failed to get device call status")
    except Exception as e:
        logger.error(f"Error getting device call status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
@api_router.post("/device/call/{number}")
async def make_call(number: str):
    """Make device call a number"""
    try:
        success = await mqtt_manager.make_call(number)
        if success:
            return {"success": True, "message": f"Call initiated to {number}"}
        else:
            raise HTTPException(status_code=500, detail="Failed to initiate call")
    except Exception as e:
        logger.error(f"Error making call: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
@api_router.post("/device/sms")
async def send_sms(sms: SmsMessage):
    """Send SMS via device"""
    try:
        # Send via MQTT
        success = await mqtt_manager.send_sms(sms.dict())
        if success:
            # Convert time_sent -> datetime
            if sms.time_sent:
                try:
                    time_str = sms.time_sent.split("+")[0]
                    dt_obj = datetime.strptime(time_str, "%d/%m/%y,%H:%M:%S")

                    # Assume UTC if no timezone given
                    dt_obj = dt_obj.replace(tzinfo=timezone.utc)

                    # Convert to human-readable time ago
                    sms.timestamp_human = humanize.naturaltime(datetime.now(timezone.utc) - dt_obj)
                except Exception as e:
                    sms.timestamp_human = "--"
                    logger.warning(f"Failed to parse sms.time_sent '{sms.time_sent}': {e}")
            else:
                sms.timestamp_human = "--"

            return {"success": True, "message": f"SMS sent to {sms.number}", "sms": sms.dict()}
        else:
            raise HTTPException(status_code=500, detail="Failed to send SMS")
    except Exception as e:
        logger.error(f"Error sending SMS: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
@api_router.post("/device/buzzer")
async def control_buzzer(enabled: bool):
    """Control device buzzer"""
    try:
        success = await mqtt_manager.control_buzzer(enabled)
        if success:
            return {"success": True, "message": f"Buzzer {'enabled' if enabled else 'disabled'}"}
        else:
            raise HTTPException(status_code=500, detail="Failed to control buzzer")
    except Exception as e:
        logger.error(f"Error controlling buzzer: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
@api_router.post("/device/vibrate")
async def control_vibrator(enabled: bool):
    """Control device vibrator"""
    try:
        success = await mqtt_manager.control_vibrator(enabled)
        if success:
            return {"success": True, "message": f"Vibrator {'enabled' if enabled else 'disabled'}"}
        else:
            raise HTTPException(status_code=500, detail="Failed to control vibrator")
    except Exception as e:
        logger.error(f"Error controlling vibrator: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
@api_router.get("/device/get_contacts")
async def get_device_contacts():
    """get device contacts"""
    try:
        await mqtt_manager.get_contacts()

        contacts = await db_manager.get_contacts()
        if contacts:
            return contacts
        else:
            return {"message": "No contacts data available"}
    except Exception as e:
        logger.error(f"Error getting device contacts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
@api_router.post("/device/set_contacts")
async def update_device_contacts(contacts: Contacts):
    """Update device contacts"""
    try:
        await db_manager.save_contacts(contacts)

        success = await mqtt_manager.set_contacts(json.loads(contacts.json(exclude_none=True)))
        if success:
            return {"success": True, "message": "Device contacts updated"}
        else:
            raise HTTPException(status_code=500, detail="Failed to update device contacts")
    except Exception as e:
        logger.error(f"Error updating device contacts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
@api_router.get("/device/get_sms/{index}")
async def set_device_sms(index: int):
    """Set a stored sms with index"""
    try:
        await mqtt_manager.get_sms(index)

        sms = await db_manager.get_sms()

        if sms:
            return sms
        else:
            return {"sms": "No sms data available"}
    except Exception as e:
        logger.error(f"Error getting sms: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
# WebSocket endpoint for real-time updates
@app.websocket("/ws/notifications")
async def websocket_endpoint(websocket: WebSocket):
    await websocket_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Send back a JSON payload
            await websocket.send_text(json.dumps({
                "type": "heartbeat",
                "data": data
            }))
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)

#---------------------------------------------------------------------------
@api_router.post("/push/register")
async def register_push_token(token_data: PushTokenRegister):
    """Register device push notification token"""
    try:
        # Save the token in the database
        await db_manager.save_push_token(
            token=token_data.token,
            device_id=token_data.deviceId,
            user_id=token_data.userId
        )
        return {"success": True, "message": "Push token registered"}
    except Exception as e:
        logger.error(f"Error registering push token: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to register push token")

def send_push_notification(token: str, title: str, body: str, data: dict = None):
    """Send push notification to a device token"""

    if not token:
        logger.warning("Attempted to send push notification to empty token")
        return {"success": False, "error": "Empty token"}

    safe_data = {}
    if data:
        for k, v in data.items():
            if isinstance(v, (dict, list)):
                safe_data[k] = json.dumps(v)
            else:
                safe_data[k] = str(v)

    message = messaging.Message(
        notification=messaging.Notification(
            title=title,
            body=body
        ),
        token=token,
        data=safe_data
    )
    
    try:
        response = messaging.send(message)
        logger.info(f"FCM push successful for token {token}. Response ID: {response}")
        return {"success": True, "response": response}

    except exceptions.FirebaseError as e:
        # Catch all Firebase-specific errors
        logger.error(f"FCM push failed for token {token}: {e.code} - {e.message}")
        return {"success": False, "error": f"{e.code} - {e.message}"}

    except Exception as e:
        # Catch unexpected errors
        logger.exception(f"Unexpected error sending FCM push to token {token}")
        return {"success": False, "error": str(e)}
    
# Include the router in the main app
app.include_router(api_router)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    try:
        # Connect to database
        await db_manager.connect()
        
        # Set MQTT callbacks
        mqtt_manager.set_callbacks(
            status_cb=handle_status_update,
            location_cb=handle_location_update,
            sms_cb=handle_sms,
            call_cb=handle_call_received,
            led_config_cb=handle_led_config,
            config_cb=handle_config,
            notification_cb=handle_notification
        )

        mqtt_manager.set_event_loop(asyncio.get_running_loop())

        mqtt_manager.last_msg = await db_manager.get_mqtt_last_msg()
        
        # Connect to MQTT broker
        success = await mqtt_manager.connect()
        if success:
            logger.info("MQTT connection established on startup")
        else:
            logger.warning("Failed to establish MQTT connection on startup")
            
        logger.info("GPS Tracker API started successfully")
        
    except Exception as e:
        logger.error(f"Error during startup: {str(e)}")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    try:
        # Disconnect MQTT
        mqtt_manager.disconnect()
        
        # Disconnect database
        await db_manager.disconnect()
        
        logger.info("GPS Tracker API shutdown completed")
        
    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}")
