from fastapi import FastAPI, APIRouter, Request, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
import os
import json
import asyncio
import requests
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import firebase_admin
from firebase_admin import messaging, credentials, exceptions, db
import requests
from pydantic import BaseModel
from math import radians, sin, cos, sqrt, atan2

loop = None

from models import (
    DeviceStatus, GpsLocation, CallStatus, LedConfig, 
    DeviceConfig, Contacts, SmsMessage, Notification
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
                f"{EMQX_API_URL}/publish",
                json=data,
                auth=(EMQX_API_KEY, EMQX_SECRET_KEY),
                headers={"Content-Type": "application/json"},
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
        
    @staticmethod
    async def check_client() -> bool:
        """Check if a client is connected to EMQX broker via HTTP API"""
        try:
            response = requests.get(
                f"{EMQX_API_URL}/clients?_page=1&_limit=50",
                auth=(EMQX_API_KEY, EMQX_SECRET_KEY),
                headers={"Content-Type": "application/json"},
            )

            if response.status_code != 200:
                logger.error(f"Failed to query clients: {response.status_code} - {response.text}")
                return False

            data = response.json()
            clients = data.get("data", [])

            # Check if any clientid starts with "Tracker"
            for client in clients:
                cid = client.get("clientid", "")
                if cid.startswith("Tracker"):
                    logger.info(f"Client connected: {cid}")
                    return True

            logger.info("No Tracker clients found connected.")
            return False

        except Exception as e:
            logger.error(f"Error checking EMQX clients: {str(e)}")
            return False


emqx_manager = EMQXManager()

#--------------------------------------------------------------------------- 
# Commands from frontend
async def execute_command(command_data):
    command = command_data.get("command", "")
    data1 = command_data.get("data1", "")
    data2 = command_data.get("data2", "")

    # wake up tracker first if its asleep
    currently_active = await firebase_manager.get_data("Tracker/status/latest/currently_active")
    if currently_active is False: 
        await emqx_manager.publish("Tracker/to/mode", "0")

        # wait until currently_active becomes True with a timeout of 30 seconds
        timeout = 30
        start = datetime.now(timezone.utc)
        while (datetime.now(timezone.utc) - start).total_seconds() < timeout:
            await asyncio.sleep(1)
            currently_active = await firebase_manager.get_data("Tracker/status/latest/currently_active")
            if currently_active is True:
                break
        else:
            # Timeout reached, log and abort
            logger.error("Tracker did not wake up within 30 seconds!")

            # Send notification
            notification = Notification(
                title="Error",
                message=f"Tracker did not wake up within 30 seconds.",
                type="high_priority"
            )
            await send_notification(notification)

            return

    if command == "get_status":
        await emqx_manager.publish("Tracker/to/request", "0")

    elif command == "get_location":
        await emqx_manager.publish("Tracker/to/request", "1")

    elif command == "get_contacts":
        await emqx_manager.publish("Tracker/to/request", "5")

    elif command == "set_contacts":
        #send the contacts json from realtime database as payload to Tracker/to/set/contacts
        contacts = await firebase_manager.get_data("Tracker/contacts")
        if "timestamp" in contacts:
            del contacts["timestamp"]
        await emqx_manager.publish("Tracker/to/set/contacts", contacts)

    elif command == "make_call":
        #send data1 as payload to Tracker/to/call
        await emqx_manager.publish("Tracker/to/call", data1)

    elif command == "send_sms":
        #send data1 and data2 in sms model json to Tracker/to/sms/send
        sms = {
            "number": data1,
            "message": data2
        }
        await emqx_manager.publish("Tracker/to/sms/send", sms)

    elif command == "get_sms":
        #send data1 as payload to Tracker/to/sms/get
        await emqx_manager.publish("Tracker/to/sms/get", data1)

    elif command == "get_ledconfig":
        await emqx_manager.publish("Tracker/to/request", "3")

    elif command == "set_ledconfig":
        #send the ledconfig json from realtime database as payload to Tracker/to/set/led_config
        ledconfig = await firebase_manager.get_data("Tracker/ledconfig")
        if "timestamp" in ledconfig:
            del ledconfig["timestamp"]
        await emqx_manager.publish("Tracker/to/set/led_config", ledconfig)

    elif command == "send_ir":
        #send data1 as payload to Tracker/to/irsend
        await emqx_manager.publish("Tracker/to/irsend", data1)
    
    elif command == "get_config":
        await emqx_manager.publish("Tracker/to/request", "4")

    elif command == "set_config":
        #send the deviceconfig json from realtime database as payload to Tracker/to/set/config
        deviceconfig = await firebase_manager.get_data("Tracker/deviceconfig")
        if "timestamp" in deviceconfig:
            del deviceconfig["timestamp"]
        await emqx_manager.publish("Tracker/to/set/config", deviceconfig)

    elif command == "mode":
        #send data1 as payload to Tracker/to/mode
        await emqx_manager.publish("Tracker/to/mode", data1)

    elif command == "mode_espnow":
        #send data1 as payload to Tracker/to/espnow/mode
        await emqx_manager.publish("Tracker/to/espnow/mode", data1)
    
    elif command == "send_espnow":
        #send data1 as payload to Tracker/to/espnow/send
        await emqx_manager.publish("Tracker/to/espnow/send", data1)

    await firebase_manager.update_data("Tracker/commands", {"pending": False})

def handle_command(event):
    data = event.data
    
    if not isinstance(data, dict) or not data.get("pending"):
        return
    
    logger.info("Command Detected!")
    
    asyncio.run_coroutine_threadsafe(execute_command(data), loop)

def handle_frontend_status(event):
    app_online = event.data

    future = asyncio.run_coroutine_threadsafe(
        firebase_manager.get_data("Tracker/status/latest/currently_active"),
        loop
    )
    currently_active = future.result()

    if app_online is False and currently_active is True:
        asyncio.run_coroutine_threadsafe(
            emqx_manager.publish("Tracker/to/app_offline", "1"),
            loop
        )

def start_listener():
    ref_commands = db.reference("Tracker/commands")
    ref_commands.listen(handle_command)
    
    ref_frontend = db.reference("Frontend/online")
    ref_frontend.listen(handle_frontend_status)

#--------------------------------------------------------------------------- 
async def send_notification(notification: Notification, user_id: str = "default_user"):
    """Save and send a push notification to Firebase + FCM"""
    
    timestamp = datetime.now(timezone.utc).isoformat()

    try:
        await firebase_manager.push_data(
            "Notifications",
            {
                "title": notification.title,
                "message": notification.message,
                "type": notification.type,
                "timestamp": timestamp
            }
        )
    except Exception as e:
        logger.error(f"Failed to save notification to Firebase: {e}")

    try:
        tokens = await firebase_manager.get_data(f"PushTokens/{user_id}")
        if not tokens:
            logger.warning("No push tokens found for user")
            return

        if not isinstance(tokens, dict) or "token" not in tokens:
            logger.error(f"Invalid token structure: {tokens}")
            return

        token = tokens["token"]

        msg = messaging.Message(
            notification=messaging.Notification(
                title=notification.title,
                body=notification.message,
            ),
            android=messaging.AndroidConfig(
                notification=messaging.AndroidNotification(
                    channel_id=notification.type or "general",
                    icon="ic_stat_notify"
                )
            ),
            token=token
        )

        try:
            response = messaging.send(msg)
            logger.info(f"Push sent to {user_id}, FCM response: {response}")
        except exceptions.FirebaseError as e:
            logger.error(f"FCM push failed: {e.code} - {e.message}")
        except Exception as e:
            logger.error(f"Unexpected FCM push error: {e}")

    except Exception as e:
        logger.error(f"Error fetching tokens or sending push: {e}")


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
            if isinstance(payload, str):
                return await webhook_newsms(payload, background_tasks)

        elif topic.endswith("/espnow/received"):
            if isinstance(payload, str):
                return await webhook_espnow(payload, background_tasks)
            
        elif topic.endswith("/notification"):
            noti_obj = Notification(**payload)
            return await webhook_notification(noti_obj, background_tasks)
        
        elif topic.endswith("/logs"):
            if isinstance(payload, dict):
                return await webhook_logs(payload, background_tasks)

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

        # send_reason: 
        # 0 - boot (non-sleepmode)
        # 1 - request (non-sleepmode)
        # 2 - request (sleepmode)
        # 3 - fix found (non-sleepmode)
        # 4 - fix found (sleepmode)
        # 5 - periodic wakeup (sleepmode)
        # 6 - going to sleep

        if status.send_reason not in (3, 4, 6):

            reason_map = {
                0: "Tracker Online",
                1: "Status Requested",
                2: "Device Woken up",
                5: "Periodic Wake up"
            }

            reason_message = reason_map.get(status.send_reason, "Unknown Status")

            notification = Notification(
                title="Status Update",
                message=f"{reason_message} - Battery: {status.bat_percent}%",
                type="status_update"
            )

            background_tasks.add_task(send_notification, notification)

        return {"success": True}

    except Exception as e:
        logger.error(f"Error handling status webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def haversine(lat1, lon1, lat2, lon2):
    """Calculate distance in meters between two lat/lon points."""
    R = 6371000  # Earth radius in meters
    phi1, phi2 = radians(lat1), radians(lat2)
    d_phi = radians(lat2 - lat1)
    d_lambda = radians(lon2 - lon1)

    a = sin(d_phi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(d_lambda / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c

async def webhook_location(location: GpsLocation, background_tasks: BackgroundTasks):
    """Handle GPS location updates from EMQX webhook"""
    try:
        stored_location = await firebase_manager.get_data("Tracker/location/latest")
        new_location = location.dict()

        # if gps fix is available, then update
        if location.gps_fix:
            logger.info("GPS fix found, updating.")
            new_location.update({
                "gps_lat": location.gps_lat,
                "gps_lon": location.gps_lon,
                "alt": location.alt,
                "speed": location.speed,
                "course": location.course,
                "sats": location.sats,
                "gps_timestamp": datetime.now(timezone.utc).isoformat()
            })

        # if lbs fix is available, then update
        if location.lbs_fix:
            logger.info("LBS fix found, updating.")
            new_location.update({
                "lbs_lat": location.lbs_lat,
                "lbs_lon": location.lbs_lon,
                "lbs_timestamp": datetime.now(timezone.utc).isoformat()
            })

        # Convert datetime objects before saving
        new_location = {
            k: (v.isoformat() if isinstance(v, datetime) else v)
            for k, v in new_location.items()
        }

        await firebase_manager.update_data("Tracker/location/latest", new_location)
        
        # If there is gps fix, then save as latest
        if location.gps_fix:

            # Calculate distance difference
            last_lat = float(stored_location.get("gps_lat", 0.0))
            last_lon = float(stored_location.get("gps_lon", 0.0))
            new_lat = float(new_location.get("gps_lat", 0.0))
            new_lon = float(new_location.get("gps_lon", 0.0))
            distance = haversine(last_lat, last_lon, new_lat, new_lon) if (last_lat and last_lon and new_lat and new_lon) else 0.0
            new_location["distance_from_last_update"] = int(distance)

            await firebase_manager.push_data("Tracker/location/history", new_location)
            
            # Send notification
            notification = Notification(
                title="Location Update",
                message=f"Moved by: {distance} meters.",
                type="location_update"
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
                message=f"Tracker receiving call from: {callstatus.number}",
                type="high_priority"
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
    
async def webhook_newsms(data: str, background_tasks: BackgroundTasks):
    """Handle New SMS messages from EMQX webhook"""
    try:
        await firebase_manager.update_data("Tracker/status/latest/stored_sms/stored_sms", data)

        # Send notification
        notification = Notification(
            title="SMS Received",
            message=f"Stored at index {data}...",
            type="general"
        )
        
        background_tasks.add_task(send_notification, notification)
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error handling New SMS webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def webhook_espnow(data: str, background_tasks: BackgroundTasks):
    """Handle messages from espnow"""
    try:
        await firebase_manager.push_data(
            "Tracker/espnow/received",
            {
                "msg": data,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )

        notif_type = "high_priority" if ("IMPORTANT" in data or "DETECTED" in data) else "general"

        # Send notification
        notification = Notification(
            title="ESP-NOW Message!",
            message=data,
            type=notif_type
        )
        background_tasks.add_task(send_notification, notification)

        return {"success": True}

    except Exception as e:
        logger.error(f"Error handling disconnection webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def webhook_notification(notification: Notification, background_tasks: BackgroundTasks):
    """Handle New SMS messages from EMQX webhook"""
    try:
        # Send notification
        notification = Notification(
            title=notification.title,
            message=notification.message,
            type=notification.type
        )
        
        background_tasks.add_task(send_notification, notification)
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error sending notification: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 
    
async def webhook_logs(data: dict, background_tasks: BackgroundTasks):
    """Handle log messages from EMQX webhook"""
    try:
        log_type = data.get("type", "").lower()
        log_msg = data.get("log", "")

        # Update Firebase log entry
        await firebase_manager.push_data(
            "Tracker/Logs",
            {
                "type": log_type,
                "log": log_msg,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )

        # If it's an error or critical log → send high priority notification
        if log_type in ["error", "critical"]:
            notification = Notification(
                title="System Alert",
                message=log_msg,
                type="high_priority"
            )
            background_tasks.add_task(send_notification, notification)

        return {"success": True}

    except Exception as e:
        logger.error(f"Error handling logs webhook: {str(e)}")
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
                type="general"
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
                type="high_priority"
            )
            background_tasks.add_task(send_notification, notification)

        return {"success": True}

    except Exception as e:
        logger.error(f"Error handling disconnection webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/")
async def root():
    return {"message": "GPS Tracker Control API", "version": "6.9.0"}

@api_router.get("/heartbeat")
async def heartbeat():
    backend_state = await firebase_manager.get_data("Backend/online")
    if backend_state is False:
        await firebase_manager.update_data(
            "Backend",
            {
                "online": True,
                "last_online": datetime.now(timezone.utc).isoformat()
            }
        )

    tracker_autowake = await firebase_manager.get_data("Preferences/tracker_autowake")
    if tracker_autowake is True:
        await emqx_manager.publish("Tracker/to/mode", "0")

    return {"message": "GPS Tracker Control API", "version": "6.9.0"}


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
    global loop
    try:
        logger.info("GPS Tracker API started successfully")

        tracker_connected = await emqx_manager.check_client()

        if tracker_connected:
            await firebase_manager.update_data(
                "Tracker/MQTT",
                {
                    "connected": True,
                    "last_connected": datetime.now(timezone.utc).isoformat()
                }
            )

        loop = asyncio.get_running_loop()

        start_listener()
        
    except Exception as e:
        logger.error(f"Error during startup: {str(e)}")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""

    await firebase_manager.update_data(
        "Backend",
        {
            "online": False,
            "last_offline": datetime.now(timezone.utc).isoformat()
        }
    )

    logger.info("GPS Tracker API shutdown completed")