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

# Import our custom modules
from models import (
    DeviceStatus, GpsLocation, Contact, ContactCreate, ContactUpdate,
    SmsMessage, SmsCreate, LedConfig, DeviceSettings, Notification, MqttStatus
)
from mqtt_client import MQTTManager
from websocket_manager import websocket_manager
from database import db_manager

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

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

# Initialize MQTT Manager
mqtt_manager = MQTTManager(
    broker="ia6350c9.ala.eu-central-1.emqxsl.com",
    port=8883,
    username="admin",
    password="MQTT6282"
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
async def handle_sms_received(sms: SmsMessage):
    """Handle received SMS messages from MQTT"""
    try:
        # Save to database
        await db_manager.save_sms_message(sms)

        data = json.loads(sms.json())
        
        # Broadcast to WebSocket clients
        await websocket_manager.broadcast_sms_update(data)
        
        logger.info("SMS message received and broadcasted")
    except Exception as e:
        logger.error(f"Error handling SMS update: {str(e)}")

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
async def handle_notification(notification: Notification):
    """Handle system notifications from MQTT"""
    try:
        # Save to database
        await db_manager.save_notification(notification)
        
        # Broadcast to WebSocket clients
        await websocket_manager.broadcast_notification(notification)
        
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

    #convert to datetime format from string
    last_msg = datetime.fromisoformat(status_data.get("last_msg"))

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
            gps_age = datetime.fromisoformat(location.get("gps_age"))
            lbs_age = datetime.fromisoformat(location.get("lbs_age"))


            if gps_age:
                location["gps_age"] = humanize.naturaltime(datetime.now(timezone.utc) - gps_age)
            else:
                location["gps_age"] = "--"

            if lbs_age:
                location["lbs_age"] = humanize.naturaltime(datetime.now(timezone.utc) - lbs_age)
            else:
                location["lbs_age"] = "--"

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
            gps_age = location.get("gps_age")
            lbs_age = location.get("lbs_age")

            if gps_age:
                location["gps_age"] = humanize.naturaltime(datetime.now(timezone.utc) - gps_age)
            else:
                location["gps_age"] = "--"

            if lbs_age:
                location["lbs_age"] = humanize.naturaltime(datetime.now(timezone.utc) - lbs_age)
            else:
                location["lbs_age"] = "--"

            return location
        else:
            return {"message": "No location data available"}
    except Exception as e:
        logger.error(f"Error getting device location: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
@api_router.post("/device/led")
async def set_led_config(config: LedConfig):
    """Set LED configuration"""
    try:
        success = await mqtt_manager.set_led_config(config.dict(exclude_none=True))
        if success:
            return {"success": True, "message": "LED configuration updated"}
        else:
            raise HTTPException(status_code=500, detail="Failed to update LED configuration")
    except Exception as e:
        logger.error(f"Error setting LED config: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
@api_router.post("/device/settings")
async def update_device_settings(settings: DeviceSettings):
    """Update device settings"""
    try:
        success = await mqtt_manager.set_device_config(settings.dict(exclude_none=True))
        if success:
            return {"success": True, "message": "Device settings updated"}
        else:
            raise HTTPException(status_code=500, detail="Failed to update device settings")
    except Exception as e:
        logger.error(f"Error updating device settings: {str(e)}")
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
async def send_sms(sms_data: SmsCreate):
    """Send SMS via device"""
    try:
        # Save to database as sent message
        sms_message = SmsMessage(
            number=sms_data.number,
            message=sms_data.sms,
            type="sent"
        )
        await db_manager.save_sms_message(sms_message)
        
        # Send via MQTT
        success = await mqtt_manager.send_sms(sms_data.dict())
        if success:
            return {"success": True, "message": f"SMS sent to {sms_data.number}"}
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
# Contact management routes
@api_router.get("/contacts", response_model=List[Contact])
async def get_contacts():
    """Get all contacts"""
    try:
        contacts = await db_manager.get_all_contacts()
        return [Contact(**contact) for contact in contacts]
    except Exception as e:
        logger.error(f"Error getting contacts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
@api_router.post("/contacts", response_model=Contact)
async def create_contact(contact_data: ContactCreate):
    """Create new contact"""
    try:
        contact = Contact(**contact_data.dict())
        contact_id = await db_manager.create_contact(contact)
        return contact
    except Exception as e:
        logger.error(f"Error creating contact: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
@api_router.put("/contacts/{contact_id}", response_model=Contact)
async def update_contact(contact_id: str, contact_data: ContactUpdate):
    """Update contact"""
    try:
        update_data = contact_data.dict(exclude_none=True)
        success = await db_manager.update_contact(contact_id, update_data)
        
        if success:
            updated_contact = await db_manager.get_contact_by_id(contact_id)
            if updated_contact:
                return Contact(**updated_contact)
        
        raise HTTPException(status_code=404, detail="Contact not found")
    except Exception as e:
        logger.error(f"Error updating contact: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
@api_router.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str):
    """Delete contact"""
    try:
        success = await db_manager.delete_contact(contact_id)
        if success:
            return {"success": True, "message": "Contact deleted"}
        else:
            raise HTTPException(status_code=404, detail="Contact not found")
    except Exception as e:
        logger.error(f"Error deleting contact: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
# SMS history routes
@api_router.get("/sms/history", response_model=List[SmsMessage])
async def get_sms_history(limit: int = 50):
    """Get SMS history"""
    try:
        messages = await db_manager.get_sms_history(limit)
        return [SmsMessage(**message) for message in messages]
    except Exception as e:
        logger.error(f"Error getting SMS history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
# Notification routes
@api_router.get("/notifications", response_model=List[Notification])
async def get_notifications(limit: int = 50, unread_only: bool = False):
    """Get notifications"""
    try:
        notifications = await db_manager.get_notifications(limit, unread_only)
        return [Notification(**notification) for notification in notifications]
    except Exception as e:
        logger.error(f"Error getting notifications: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    """Mark notification as read"""
    try:
        success = await db_manager.mark_notification_read(notification_id)
        if success:
            return {"success": True, "message": "Notification marked as read"}
        else:
            raise HTTPException(status_code=404, detail="Notification not found")
    except Exception as e:
        logger.error(f"Error marking notification as read: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
@api_router.get("/notifications/unread-count")
async def get_unread_notification_count():
    """Get count of unread notifications"""
    try:
        count = await db_manager.get_unread_notification_count()
        return {"count": count}
    except Exception as e:
        logger.error(f"Error getting unread notification count: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

#---------------------------------------------------------------------------  
# WebSocket endpoint for real-time updates
@app.websocket("/ws/notifications")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time notifications"""
    await websocket_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
            # Echo back for heartbeat
            await websocket.send_text(f"Echo: {data}")
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)

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
            sms_cb=handle_sms_received,
            call_cb=handle_call_received,
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
