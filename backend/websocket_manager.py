import json
import logging
from typing import Dict, Set
from fastapi import WebSocket, WebSocketDisconnect
from models import Notification

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

    def disconnect(self, websocket: WebSocket):
        """Remove WebSocket connection"""
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket client disconnected. Total connections: {len(self.active_connections)}")

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

async def broadcast_notification(self, notification: Notification):
    """Broadcast notification to all connected clients and send FCM"""
    from server import send_push_notification

    # WebSocket broadcast
    try:
        message = {
            "type": "notification",
            "data": {
                "id": notification.id,
                "title": notification.title,
                "message": notification.message,
                "notification_type": notification.type,
                "data": notification.data,
                "timestamp": notification.timestamp.isoformat()
            }
        }
        await self.broadcast(json.dumps(message))
        logger.info(f"Broadcasted notification: {notification.title}")
    except Exception as e:
        logger.error(f"WebSocket broadcast failed: {str(e)}")

    # Fetch FCM tokens from DB
    fcm_tokens = []
    tokens_cursor = self.push_tokens_collection.find({"user_id": "user123"})
    fcm_tokens = [t["token"] for t in await tokens_cursor.to_list(length=100)]

    # Send FCM push notifications
    if not fcm_tokens:
        logger.warning("No FCM tokens found for user. Skipping push notifications.")
        return

    for token in fcm_tokens:
        if not token:
            logger.warning("Empty FCM token found. Skipping.")
            continue
        try:
            result = await send_push_notification(
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


    def get_connection_count(self) -> int:
        #Get number of active WebSocket connections
        return len(self.active_connections) 
    
# Global WebSocket manager instance
websocket_manager = WebSocketManager()