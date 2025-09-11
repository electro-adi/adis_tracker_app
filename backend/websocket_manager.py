import json
import logging
from typing import Dict, Set
from fastapi import WebSocket, WebSocketDisconnect
from models import Notification
from datetime import datetime, timezone
import humanize
from mqtt_client import MQTTManager

from database import db_manager

logger = logging.getLogger(__name__)

class WebSocketManager:
    def __init__(self):
        # Store active WebSocket connections
        self.active_connections: Set[WebSocket] = set()
        
    async def connect(self, websocket: WebSocket):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket client connected. Total connections: {len(self.active_connections)}")

    async def disconnect(self, websocket: WebSocket):
        """Remove WebSocket connection"""
        self.active_connections.discard(websocket)

        total_connections = len(self.active_connections)
        logger.info(f"WebSocket client disconnected. Total connections: {total_connections}")

        # If no active clients left, mark app as offline
        if total_connections == 0:
            try:
                await mqtt_manager.app_offline()
                logger.info("All clients disconnected. Sent app_offline MQTT message.")
            except Exception as e:
                logger.error(f"Failed to send app_offline message: {e}")


    async def send_personal_message(self, message: str, websocket: WebSocket):
        """Send message to specific WebSocket connection"""
        try:
            await websocket.send_text(message)
        except Exception as e:
            logger.error(f"Error sending personal message: {str(e)}")
            self.disconnect(websocket)

    async def broadcast(self, message: str):
        """Broadcast message to all connected WebSocket clients"""
        if not self.active_connections:
            return
            
        disconnected = set()
        
        for connection in self.active_connections.copy():
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error broadcasting to client: {str(e)}")
                disconnected.add(connection)
        
        # Remove disconnected clients
        for connection in disconnected:
            self.disconnect(connection)

    async def broadcast_notification(self, notification: Notification, user_id: str = None):
        from server import send_push_notification

        # WebSocket broadcast
        try:
            message = {
                "type": "notification",
                "data": {
                    "title": notification.title,
                    "message": notification.message,
                    "notification_type": notification.type,
                    "data": notification.data,
                }
            }
            await self.broadcast(json.dumps(message))
            logger.info(f"Broadcasted notification: {notification.title}")
        except Exception as e:
            logger.error(f"WebSocket broadcast failed: {str(e)}")

        # Retrieve FCM tokens
        fcm_tokens = []
        if user_id:
            fcm_tokens = await db_manager.get_push_tokens(user_id)

        # Send Firebase push notifications
        if not fcm_tokens:
            logger.warning("No FCM tokens found. Skipping push notifications.")
            return

        for token in fcm_tokens:
            if not token:
                logger.warning("Empty FCM token found. Skipping.")
                continue

            try:
                result = send_push_notification(
                    token=token,
                    title=notification.title,
                    body=notification.message,
                    data=notification.data or {}
                )
                logger.info(f"FCM push sent to token {token}: {result}")
            except Exception as e:
                logger.error(f"FCM push failed for token {token}: {str(e)}")

    async def broadcast_status_update(self, status_data: dict):
        #Broadcast device status update
        try:
            # Normalize last_activity
            last_activity = status_data.get("last_activity")

            if isinstance(last_activity, str) and last_activity not in ("N/A", "", None):
                try:
                    last_activity = datetime.fromisoformat(last_activity)
                except ValueError:
                    last_activity = None
            else:
                last_activity = None

            if last_activity and last_activity.tzinfo is None:
                last_activity = last_activity.replace(tzinfo=timezone.utc)

            if last_activity:
                status_data["last_activity_human"] = humanize.naturaltime(
                    datetime.now(timezone.utc) - last_activity
                )
            else:
                status_data["last_activity_human"] = "--"

            message = {
                "type": "status_update",
                "data": status_data
            }
            
            await self.broadcast(json.dumps(message))
            logger.info("Broadcasted status update")
            
        except Exception as e:
            logger.error(f"Error broadcasting status update: {str(e)}")

    async def broadcast_location_update(self, location_data: dict):
        #Broadcast GPS location update
        try:
            # convert to datetime format from string
            gps_age = location_data.get("gps_age")
            lbs_age = location_data.get("lbs_age")

            if isinstance(gps_age, str):
                gps_age = datetime.fromisoformat(gps_age)

            if isinstance(lbs_age, str):
                lbs_age = datetime.fromisoformat(lbs_age)

            if gps_age and gps_age.tzinfo is None:
                gps_age = gps_age.replace(tzinfo=timezone.utc)

            if lbs_age and lbs_age.tzinfo is None:
                lbs_age = lbs_age.replace(tzinfo=timezone.utc)

            if gps_age:
                location_data["gps_age_human"] = humanize.naturaltime(datetime.now(timezone.utc) - gps_age)
            else:
                location_data["gps_age_human"] = "--"

            if lbs_age:
                location_data["lbs_age_human"] = humanize.naturaltime(datetime.now(timezone.utc) - lbs_age)
            else:
                location_data["lbs_age_human"] = "--"
                message = {
                    "type": "location_update", 
                    "data": location_data
                }
            
            await self.broadcast(json.dumps(message))
            logger.info("Broadcasted location update")
            
        except Exception as e:
            logger.error(f"Error broadcasting location update: {str(e)}")

    async def broadcast_sms_update(self, sms_data: dict):
        #Broadcast SMS received update
        try:
            message = {
                "type": "sms_update",
                "data": sms_data
            }
            
            await self.broadcast(json.dumps(message))
            logger.info("Broadcasted SMS update")
            
        except Exception as e:
            logger.error(f"Error broadcasting SMS update: {str(e)}")

    async def broadcast_call_update(self, caller_number: str):
        #Broadcast incoming call update
        try:
            message = {
                "type": "call_update",
                "data": {
                    "caller": caller_number,
                    "timestamp": "now"
                }
            }
            
            await self.broadcast(json.dumps(message))
            logger.info(f"Broadcasted call update from: {caller_number}")
            
        except Exception as e:
            logger.error(f"Error broadcasting call update: {str(e)}")

    async def broadcast_led_config_update(self, led_config_data: dict):
        #Broadcast led config update
        try:
            message = {
                "type": "led_config_update",
                "data": led_config_data
            }
            
            await self.broadcast(json.dumps(message))
            logger.info("Broadcasted LED configuration update")

        except Exception as e:
            logger.error(f"Error broadcasting LED configuration update: {str(e)}")

    async def broadcast_config_update(self, config_data: dict):
        #Broadcast device configuration update
        try:
            message = {
                "type": "config_update",
                "data": config_data
            }
            
            await self.broadcast(json.dumps(message))
            logger.info("Broadcasted device configuration update")

        except Exception as e:
            logger.error(f"Error broadcasting device configuration update: {str(e)}")

    async def broadcast_contacts_update(self, contacts_data: dict):
        #Broadcast device configuration update
        try:
            message = {
                "type": "contacts_update",
                "data": contacts_data
            }
            
            await self.broadcast(json.dumps(message))
            logger.info("Broadcasted device contacts update")

        except Exception as e:
            logger.error(f"Error broadcasting device contacts update: {str(e)}")

    def get_connection_count(self) -> int:
        #Get number of active WebSocket connections
        return len(self.active_connections) 
    
# Global WebSocket manager instance
websocket_manager = WebSocketManager()