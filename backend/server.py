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
    DeviceStatus, GpsLocation, CallStatus, LedConfig, DeviceConfig,
    Contacts, SmsMessage, Notification, PushTokenRegister
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
app = FastAPI(title="GPS Tracker Control API", version="6.9.0")

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
        f"Notifications",
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
async def webhook_mqtt(request: Request, background_tasks: BackgroundTasks):
    """Catch all MQTT messages from EMQX connector"""
    try:
        body = await request.json()

        topic = body.get("topic")
        payload_raw = body.get("payload")
        
        try:
            payload = json.loads(payload_raw)
        except Exception:
            payload = payload_raw

        logger.info(f"MQTT Message → Topic: {topic}, Payload: {payload}")


        if "Tracker/from/" in topic:
            await firebase_manager.update_data(
                f"Tracker/MQTT",
                {
                    "last_message": datetime.now(timezone.utc).isoformat()
                }
            )

        # Route based on topic
        if topic.endswith("/status"):
            status_obj = DeviceStatus(**payload)
            return await webhook_status(status_obj, background_tasks)

        elif topic.endswith("/location"):
            loc_obj = GpsLocation(**payload)
            return await webhook_location(loc_obj, background_tasks)

        elif topic.endswith("/callstatus"):
            cals_obj = CallStatus(**payload)
            return await webhook_callstatus(cals_obj, background_tasks)
    
        elif topic.endswith("/led_config"):
            ledconf_obj = LedConfig(**payload)
            return await webhook_ledconfig(ledconf_obj, background_tasks)
    
        elif topic.endswith("/config"):
            conf_obj = DeviceConfig(**payload)
            return await webhook_deviceconfig(conf_obj, background_tasks)
    
        elif topic.endswith("/contacts"):
            ctns_obj = Contacts(**payload)
            return await webhook_contacts(ctns_obj, background_tasks)
        
        elif topic.endswith("/sms/stored"):
            ssms_obj = SmsMessage(**payload)
            return await webhook_storedsms(ssms_obj, background_tasks)
        
        elif topic.endswith("/sms/received"):
            nsms_obj = SmsMessage(**payload)
            return await webhook_newsms(nsms_obj, background_tasks)
        
        elif topic.endswith("/events/connection"):
            if isinstance(payload, dict):
                return await webhook_connection(payload, background_tasks)
        
        elif topic.endswith("/events/disconnection"):
            if isinstance(payload, dict):
                return await webhook_disconnection(payload, background_tasks)

        else:
            logger.warning(f"Unhandled topic: {topic}")

        return {"success": True}
    except Exception as e:
        logger.error(f"Error processing MQTT webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
async def webhook_status(status: DeviceStatus, background_tasks: BackgroundTasks):
    """Handle device status updates from EMQX webhook"""
    try:
        status_dict = status.dict()
        status_dict["timestamp"] = datetime.now(timezone.utc).isoformat()
        
        # Save to Firebase
        await firebase_manager.update_data("Tracker/status/latest", status_dict)
        await firebase_manager.push_data("Tracker/status/history", status_dict)
        
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

async def webhook_location(location: GpsLocation, background_tasks: BackgroundTasks):
    """Handle GPS location updates from EMQX webhook"""
    try:
        location_dict = location.dict()
        
        # Update age timestamps
        if location.gps_lat and location.gps_lon:
            location_dict["gps_timestamp"] = datetime.now(timezone.utc).isoformat()
        if location.lbs_lat and location.lbs_lon:
            location_dict["lbs_timestamp"] = datetime.now(timezone.utc).isoformat()
        
        # Handle invalid GPS coordinates
        if location.gps_lat == 0.0 and location.gps_lon == 0.0:
            last_good = await firebase_manager.get_data("Tracker/location/latest")
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
            await firebase_manager.update_data("Tracker/location/latest", location_dict)
        
        # Save to Firebase
        await firebase_manager.push_data("Tracker/location/history", location_dict)
        
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

async def webhook_callstatus(callstatus: CallStatus, background_tasks: BackgroundTasks):
    """Handle CallStatus messages from EMQX webhook"""
    try:
        callstatus_dict = callstatus.dict()
        callstatus_dict["timestamp"] = datetime.now(timezone.utc).isoformat()
        
        # Save to Firebase
        await firebase_manager.update_data("Tracker/callstatus", callstatus_dict)
        
        # Send notification
        if callstatus.status == 2:  # Incoming call
            notification = Notification(
                title="Incoming Call",
                message=f"Device receiving call from: {callstatus.number}",
                type="call",
                data=callstatus_dict
            )
            background_tasks.add_task(send_notification, notification)
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error handling CallStatus webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
async def webhook_ledconfig(ledconfig: LedConfig, background_tasks: BackgroundTasks):
    """Handle LedConfig messages from EMQX webhook"""
    try:
        ledconfig_dict = ledconfig.dict()
        ledconfig_dict["timestamp"] = datetime.now(timezone.utc).isoformat()
        
        # Save to Firebase
        await firebase_manager.update_data("Tracker/ledconfig", ledconfig_dict)
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error handling LedConfig webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def webhook_deviceconfig(deviceconfig: DeviceConfig, background_tasks: BackgroundTasks):
    """Handle deviceconfig messages from EMQX webhook"""
    try:
        deviceconfig_dict = deviceconfig.dict()
        deviceconfig_dict["timestamp"] = datetime.now(timezone.utc).isoformat()
        
        # Save to Firebase
        await firebase_manager.update_data("Tracker/deviceconfig", deviceconfig_dict)
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error handling deviceconfig webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def webhook_contacts(contacts: Contacts, background_tasks: BackgroundTasks):
    """Handle contacts messages from EMQX webhook"""
    try:
        contacts_dict = contacts.dict()
        contacts_dict["timestamp"] = datetime.now(timezone.utc).isoformat()
        
        # Save to Firebase
        await firebase_manager.update_data("Tracker/contacts", contacts_dict)
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error handling contacts webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def webhook_storedsms(storedsms: SmsMessage, background_tasks: BackgroundTasks):
    """Handle Stored SMS messages from EMQX webhook"""
    try:
        storedsms_dict = storedsms.dict()
        storedsms_dict["timestamp"] = datetime.now(timezone.utc).isoformat()
        
        # Save to Firebase
        await firebase_manager.update_data("Tracker/storedsms", storedsms_dict)
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error handling Stored SMS webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
async def webhook_newsms(newsms: SmsMessage, background_tasks: BackgroundTasks):
    """Handle New SMS messages from EMQX webhook"""
    try:
        newsms_dict = newsms.dict()
        newsms_dict["timestamp"] = datetime.now(timezone.utc).isoformat()
        
        # Save to Firebase
        await firebase_manager.update_data("Tracker/newsms", newsms_dict)
        
        # Send notification
        notification = Notification(
            title="SMS Received",
            message=f"From {newsms.number}: {newsms.message[:50]}...",
            type="sms",
            data=newsms_dict
        )
        
        background_tasks.add_task(send_notification, notification)
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error handling New SMS webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
async def webhook_connection(data: dict, background_tasks: BackgroundTasks):
    """Handle connection messages from EMQX webhook"""
    try:
        clientid = data.get("clientid", "")

        if clientid.startswith("Tracker"):
            await firebase_manager.update_data(
                f"Tracker/MQTT",
                {
                    "connected": True,
                    "last_connected": datetime.now(timezone.utc).isoformat()
                }
            )

            # Send notification
            notification = Notification(
                title="Tracker Connected",
                message=f"Device {clientid} just connected",
                type="system",
                data=data
            )
            background_tasks.add_task(send_notification, notification)

        return {"success": True}

    except Exception as e:
        logger.error(f"Error handling connection webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def webhook_disconnection(data: dict, background_tasks: BackgroundTasks):
    """Handle disconnection messages from EMQX webhook"""
    try:
        clientid = data.get("clientid", "")

        if clientid.startswith("Tracker"):
            # Update Firebase state
            await firebase_manager.update_data(
                f"Tracker/MQTT",
                {
                    "connected": False,
                    "last_disconnected": datetime.now(timezone.utc).isoformat()
                }
            )

            # Send notification
            notification = Notification(
                title="Tracker Disconnected",
                message=f"Device {clientid} just disconnected",
                type="system",
                data=data
            )
            background_tasks.add_task(send_notification, notification)

        return {"success": True}

    except Exception as e:
        logger.error(f"Error handling disconnection webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

app.include_router(api_router)

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

        await firebase_manager.update_data(
            f"Backend",
            {
                "online": True,
                "last_online": datetime.now(timezone.utc).isoformat()
            }
        )
        
    except Exception as e:
        logger.error(f"Error during startup: {str(e)}")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""

    await firebase_manager.update_data(
        f"Backend",
        {
            "online": False,
            "last_offline": datetime.now(timezone.utc).isoformat()
        }
    )

    logger.info("GPS Tracker API shutdown completed")