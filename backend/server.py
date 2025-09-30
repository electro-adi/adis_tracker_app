from fastapi import FastAPI, APIRouter, Request, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
import os
import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import humanize
import firebase_admin
from firebase_admin import messaging, credentials, exceptions, db
import requests
from pydantic import BaseModel

# Import models
from models import (
    DeviceStatus, GpsLocation, Contacts, SmsMessage, LedConfig, 
    DeviceSettings, Notification, PushTokenRegister
)

# Firebase initialization
firebase_json_str = os.getenv("FIREBASE_ADMIN_SDK_JSON")
firebase_db_url = os.getenv("FIREBASE_DATABASE_URL")
cred = credentials.Certificate(json.loads(firebase_json_str))

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred, {
        'databaseURL': firebase_db_url
    })

# EMQX Configuration
EMQX_API_URL = os.getenv("EMQX_API_URL")
EMQX_API_KEY = os.getenv("EMQX_API_KEY")
EMQX_SECRET_KEY = os.getenv("EMQX_SECRET_KEY")

# Create the main app
app = FastAPI(title="GPS Tracker Control API", version="2.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

#--------------------------------------------------------------------------- 
# Firebase Realtime Database Helper Functions
class FirebaseManager:
    @staticmethod
    def get_ref(path: str):
        """Get Firebase database reference"""
        return db.reference(path)
    
    @staticmethod
    async def save_data(path: str, data: dict):
        """Save data to Firebase"""
        try:
            ref = db.reference(path)
            ref.set(data)
            logger.info(f"Data saved to Firebase at {path}")
        except Exception as e:
            logger.error(f"Error saving to Firebase: {str(e)}")
            raise
    
    @staticmethod
    async def update_data(path: str, data: dict):
        """Update data in Firebase"""
        try:
            ref = db.reference(path)
            ref.update(data)
            logger.info(f"Data updated in Firebase at {path}")
        except Exception as e:
            logger.error(f"Error updating Firebase: {str(e)}")
            raise
    
    @staticmethod
    async def get_data(path: str) -> Optional[dict]:
        """Get data from Firebase"""
        try:
            ref = db.reference(path)
            return ref.get()
        except Exception as e:
            logger.error(f"Error getting data from Firebase: {str(e)}")
            return None
    
    @staticmethod
    async def push_data(path: str, data: dict) -> str:
        """Push data to Firebase list"""
        try:
            ref = db.reference(path)
            new_ref = ref.push(data)
            return new_ref.key
        except Exception as e:
            logger.error(f"Error pushing to Firebase: {str(e)}")
            raise

firebase_manager = FirebaseManager()

#--------------------------------------------------------------------------- 
# EMQX HTTP API Helper
class EMQXManager:
    @staticmethod
    async def publish(topic: str, payload: Any) -> bool:
        """Publish message to EMQX broker via HTTP API"""
        try:
            if isinstance(payload, (dict, list)):
                payload_str = json.dumps(payload)
            else:
                payload_str = str(payload)
            
            data = {
                "topic": topic,
                "qos": 1,
                "payload": payload_str
            }
            
            response = requests.post(
                EMQX_API_URL,
                json=data,
                auth=(EMQX_API_KEY, EMQX_SECRET_KEY),
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                logger.info(f"Published to {topic}: {payload_str}")
                return True
            else:
                logger.error(f"Failed to publish to EMQX: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error publishing to EMQX: {str(e)}")
            return False

emqx_manager = EMQXManager()

#--------------------------------------------------------------------------- 
# Push Notification Helper
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
        logger.info(f"FCM push successful. Response ID: {response}")
        return {"success": True, "response": response}
    except exceptions.FirebaseError as e:
        logger.error(f"FCM push failed: {e.code} - {e.message}")
        return {"success": False, "error": f"{e.code} - {e.message}"}
    except Exception as e:
        logger.exception(f"Unexpected error sending FCM push")
        return {"success": False, "error": str(e)}

async def send_notification(notification: Notification, user_id: str = "default_user"):
    """Send notification via Firebase and push notifications"""
    # Save to Firebase for real-time updates
    await firebase_manager.update_data(
        f"notifications/{user_id}/latest",
        {
            "title": notification.title,
            "message": notification.message,
            "type": notification.type,
            "data": notification.data or {},
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    )
    
    # Also push to notification history
    await firebase_manager.push_data(
        f"notifications/{user_id}/history",
        {
            "title": notification.title,
            "message": notification.message,
            "type": notification.type,
            "data": notification.data or {},
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    )
    
    # Send push notifications
    tokens = await firebase_manager.get_data(f"push_tokens/{user_id}")
    if tokens:
        for device_id, token_data in tokens.items():
            if token_data and "token" in token_data:
                send_push_notification(
                    token=token_data["token"],
                    title=notification.title,
                    body=notification.message,
                    data=notification.data or {}
                )

#--------------------------------------------------------------------------- 
# Webhook endpoints for EMQX HTTP connector
@api_router.post("/webhook/mqtt")
async def webhook_mqtt(request: Request):
    """Catch all MQTT messages from EMQX connector"""
    try:
        body = await request.json()

        topic = body.get("topic")
        payload_raw = body.get("payload")

        # Payload is usually a string; if it's JSON, parse it
        try:
            payload = json.loads(payload_raw)
        except Exception:
            payload = payload_raw

        logger.info(f"MQTT Message → Topic: {topic}, Payload: {payload}")

        # Example: route messages depending on topic
        if topic.endswith("/status"):
            # process status payload
            ...
        elif topic.endswith("/location"):
            # process location payload
            ...
        elif topic.endswith("/sms"):
            ...
        elif topic.endswith("/call"):
            ...
        else:
            logger.warning(f"Unhandled topic: {topic}")

        return {"success": True}
    except Exception as e:
        logger.error(f"Error processing MQTT webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/webhook/status")
async def webhook_status(status: DeviceStatus, background_tasks: BackgroundTasks):
    """Handle device status updates from EMQX webhook"""
    try:
        status_dict = status.dict()
        status_dict["timestamp"] = datetime.now(timezone.utc).isoformat()
        
        # Save to Firebase
        await firebase_manager.update_data("device/status/current", status_dict)
        await firebase_manager.push_data("device/status/history", status_dict)
        
        # Send notification
        reason_map = {
            (0, 1): "Device is online",
            (2, 3): "Device woken up",
            (4,): "Periodic Wake up"
        }
        reason_message = next((msg for keys, msg in reason_map.items() if status.send_reason in keys), "Unknown status")
        
        notification = Notification(
            title="Device Status Updated",
            message=f"{reason_message} - Battery: {status.bat_percent}%",
            type="status",
            data=status_dict
        )
        
        background_tasks.add_task(send_notification, notification)
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error handling status webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/webhook/location")
async def webhook_location(location: GpsLocation, background_tasks: BackgroundTasks):
    """Handle GPS location updates from EMQX webhook"""
    try:
        location_dict = location.dict()
        
        # Update age timestamps
        if location.gps_lat and location.gps_lon:
            location_dict["gps_age"] = datetime.now(timezone.utc).isoformat()
        if location.lbs_lat and location.lbs_lon:
            location_dict["lbs_age"] = datetime.now(timezone.utc).isoformat()
        
        location_dict["timestamp"] = datetime.now(timezone.utc).isoformat()
        
        # Handle invalid GPS coordinates
        if location.gps_lat == 0.0 and location.gps_lon == 0.0:
            last_good = await firebase_manager.get_data("device/location/last_good_gps")
            if last_good:
                location_dict.update({
                    "gps_lat": last_good.get("gps_lat", 0.0),
                    "gps_lon": last_good.get("gps_lon", 0.0),
                    "alt": last_good.get("alt", 0.0),
                    "speed": last_good.get("speed", 0.0),
                    "course": last_good.get("course", 0.0),
                    "sats": last_good.get("sats", 0)
                })
        else:
            # Save as last good GPS
            await firebase_manager.update_data("device/location/last_good_gps", location_dict)
        
        # Save to Firebase
        await firebase_manager.update_data("device/location/current", location_dict)
        await firebase_manager.push_data("device/location/history", location_dict)
        
        # Send notification
        notification = Notification(
            title="Location Updated",
            message=f"New GPS coordinates: {location.gps_lat:.6f}, {location.gps_lon:.6f}",
            type="location",
            data=location_dict
        )
        
        background_tasks.add_task(send_notification, notification)
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error handling location webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/webhook/sms")
async def webhook_sms(sms: SmsMessage, background_tasks: BackgroundTasks):
    """Handle SMS messages from EMQX webhook"""
    try:
        sms_dict = sms.dict()
        sms_dict["timestamp"] = datetime.now(timezone.utc).isoformat()
        
        # Save to Firebase
        await firebase_manager.update_data("device/sms/latest", sms_dict)
        await firebase_manager.push_data("device/sms/history", sms_dict)
        
        # Send notification
        notification = Notification(
            title="SMS Received",
            message=f"From {sms.number}: {sms.message[:50]}...",
            type="sms",
            data=sms_dict
        )
        
        background_tasks.add_task(send_notification, notification)
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error handling SMS webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/webhook/call")
async def webhook_call(data: dict, background_tasks: BackgroundTasks):
    """Handle incoming call notifications from EMQX webhook"""
    try:
        caller = data.get("number", "Unknown")
        status = data.get("status", 0)
        
        call_data = {
            "caller": caller,
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Save to Firebase
        await firebase_manager.update_data("device/call/latest", call_data)
        
        if status == 2:  # Incoming call
            notification = Notification(
                title="Incoming Call",
                message=f"Device receiving call from: {caller}",
                type="call",
                data=call_data
            )
            background_tasks.add_task(send_notification, notification)
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error handling call webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#--------------------------------------------------------------------------- 
# API Endpoints
@api_router.get("/")
async def root():
    return {"message": "GPS Tracker Control API", "version": "2.0.0"}

@api_router.get("/health")
async def health_check():
    firebase_connected = firebase_admin._apps.get('[DEFAULT]') is not None
    return {
        "status": "healthy",
        "firebase_connected": firebase_connected,
        "emqx_configured": bool(EMQX_API_KEY)
    }

@api_router.post("/device/mode/{mode}")
async def set_device_mode(mode: int):
    """Set device mode (0-7)"""
    if mode < 0 or mode > 7:
        raise HTTPException(status_code=400, detail="Mode must be between 0 and 7")
    
    success = await emqx_manager.publish("Tracker/to/mode", str(mode))
    if success:
        await firebase_manager.update_data("device/mode", {"value": mode, "timestamp": datetime.now(timezone.utc).isoformat()})
        return {"success": True, "message": f"Device mode set to {mode}"}
    else:
        raise HTTPException(status_code=500, detail="Failed to set device mode")

@api_router.get("/device/status")
async def get_device_status():
    """Get current device status"""
    try:
        # Request fresh status from device
        await emqx_manager.publish("Tracker/to/request", "0")
        
        # Return latest status from Firebase
        status = await firebase_manager.get_data("device/status/current")
        
        if status:
            # Add human-readable time
            last_activity = status.get("last_activity")
            if last_activity:
                try:
                    dt = datetime.fromisoformat(last_activity)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    status["last_activity_human"] = humanize.naturaltime(datetime.now(timezone.utc) - dt)
                except:
                    status["last_activity_human"] = "--"
            
            return status
        else:
            return {"message": "No status data available"}
    except Exception as e:
        logger.error(f"Error getting device status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/device/location")
async def get_device_location():
    """Get current device location"""
    try:
        # Request fresh location from device
        await emqx_manager.publish("Tracker/to/request", "1")
        
        # Return latest location from Firebase
        location = await firebase_manager.get_data("device/location/current")
        
        if location:
            # Add human-readable age
            for age_field in ["gps_age", "lbs_age"]:
                age_value = location.get(age_field)
                if age_value:
                    try:
                        dt = datetime.fromisoformat(age_value)
                        if dt.tzinfo is None:
                            dt = dt.replace(tzinfo=timezone.utc)
                        location[f"{age_field}_human"] = humanize.naturaltime(datetime.now(timezone.utc) - dt)
                    except:
                        location[f"{age_field}_human"] = "--"
            
            return location
        else:
            return {"message": "No location data available"}
    except Exception as e:
        logger.error(f"Error getting device location: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/device/location_history")
async def get_device_location_history(limit: int = 100):
    """Get device location history"""
    try:
        history = await firebase_manager.get_data("device/location/history")
        if history:
            # Convert dict to list and sort by timestamp
            locations = list(history.values())
            locations.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
            return locations[:limit]
        return []
    except Exception as e:
        logger.error(f"Error getting location history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/device/led")
async def set_led_config(ledconfig: LedConfig):
    """Set LED configuration"""
    try:
        config_dict = ledconfig.dict(exclude_none=True)
        success = await emqx_manager.publish("Tracker/to/set/led_config", config_dict)
        
        if success:
            await firebase_manager.update_data("device/config/led", config_dict)
            return {"success": True, "message": "LED configuration updated"}
        else:
            raise HTTPException(status_code=500, detail="Failed to update LED configuration")
    except Exception as e:
        logger.error(f"Error setting LED config: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/device/settings")
async def update_device_settings(settings: DeviceSettings):
    """Update device settings"""
    try:
        settings_dict = settings.dict(exclude_none=True)
        success = await emqx_manager.publish("Tracker/to/set/config", settings_dict)
        
        if success:
            await firebase_manager.update_data("device/config/settings", settings_dict)
            return {"success": True, "message": "Device settings updated"}
        else:
            raise HTTPException(status_code=500, detail="Failed to update device settings")
    except Exception as e:
        logger.error(f"Error updating device settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/device/call/{number}")
async def make_call(number: str):
    """Make device call a number"""
    try:
        success = await emqx_manager.publish("Tracker/to/call", number)
        if success:
            return {"success": True, "message": f"Call initiated to {number}"}
        else:
            raise HTTPException(status_code=500, detail="Failed to initiate call")
    except Exception as e:
        logger.error(f"Error making call: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/device/sms")
async def send_sms(sms: SmsMessage):
    """Send SMS via device"""
    try:
        success = await emqx_manager.publish("Tracker/to/sms/send", sms.dict())
        if success:
            await firebase_manager.push_data("device/sms/sent", {
                **sms.dict(),
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            return {"success": True, "message": f"SMS sent to {sms.number}"}
        else:
            raise HTTPException(status_code=500, detail="Failed to send SMS")
    except Exception as e:
        logger.error(f"Error sending SMS: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/device/buzzer")
async def control_buzzer(enabled: bool):
    """Control device buzzer"""
    try:
        success = await emqx_manager.publish("Tracker/to/scream", enabled)
        if success:
            return {"success": True, "message": f"Buzzer {'enabled' if enabled else 'disabled'}"}
        else:
            raise HTTPException(status_code=500, detail="Failed to control buzzer")
    except Exception as e:
        logger.error(f"Error controlling buzzer: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/device/vibrate")
async def control_vibrator(enabled: bool):
    """Control device vibrator"""
    try:
        success = await emqx_manager.publish("Tracker/to/vibrate", enabled)
        if success:
            return {"success": True, "message": f"Vibrator {'enabled' if enabled else 'disabled'}"}
        else:
            raise HTTPException(status_code=500, detail="Failed to control vibrator")
    except Exception as e:
        logger.error(f"Error controlling vibrator: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/device/contacts")
async def update_device_contacts(contacts: Contacts):
    """Update device contacts"""
    try:
        contacts_dict = contacts.dict(exclude_none=True)
        success = await emqx_manager.publish("Tracker/to/set/contacts", contacts_dict)
        
        if success:
            await firebase_manager.update_data("device/contacts", contacts_dict)
            return {"success": True, "message": "Device contacts updated"}
        else:
            raise HTTPException(status_code=500, detail="Failed to update device contacts")
    except Exception as e:
        logger.error(f"Error updating device contacts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/push/register")
async def register_push_token(token_data: PushTokenRegister):
    """Register device push notification token"""
    try:
        await firebase_manager.update_data(
            f"push_tokens/{token_data.userId}/{token_data.deviceId}",
            {
                "token": token_data.token,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        )
        return {"success": True, "message": "Push token registered"}
    except Exception as e:
        logger.error(f"Error registering push token: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to register push token")

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
        # Test Firebase connection
        test_ref = db.reference("_test")
        test_ref.set({"startup": datetime.now(timezone.utc).isoformat()})
        test_ref.delete()
        
        logger.info("GPS Tracker API started successfully")
        logger.info("Firebase Realtime Database connected")
        logger.info("Ready to receive webhooks from EMQX")
        
    except Exception as e:
        logger.error(f"Error during startup: {str(e)}")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("GPS Tracker API shutdown completed")