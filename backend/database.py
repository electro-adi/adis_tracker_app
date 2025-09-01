import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from typing import List, Optional, Dict, Any
from datetime import datetime
from models import DeviceStatus, GpsLocation, Contact, SmsMessage, LedConfig, DeviceSettings, Notification

logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.db = None
        
    async def connect(self):
        """Connect to MongoDB"""
        try:
            mongo_url = os.environ.get('MONGO_URL')
            db_name = os.environ.get('DB_NAME', 'gps_tracker')
            
            self.client = AsyncIOMotorClient(mongo_url)
            self.db = self.client[db_name]

            self.push_tokens_collection = self.db["push_tokens"]
            
            # Test connection
            await self.client.admin.command('ping')
            logger.info("Connected to MongoDB successfully")
            
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {str(e)}")
            raise

    async def disconnect(self):
        """Disconnect from MongoDB"""
        if self.client:
            self.client.close()
            logger.info("Disconnected from MongoDB")

    # Device Status operations
    async def save_device_status(self, status: DeviceStatus) -> str:
        """Save device status to database"""
        try:
            result = await self.db.device_status.insert_one(status.dict())
            logger.info(f"Saved device status with ID: {result.inserted_id}")
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Error saving device status: {str(e)}")
            raise

    async def get_latest_device_status(self) -> Optional[Dict[str, Any]]:
        """Get the most recent device status"""
        try:
            status = await self.db.device_status.find_one(
                sort=[("timestamp", -1)]
            )
            if status:
                status['_id'] = str(status['_id'])
            return status
        except Exception as e:
            logger.error(f"Error getting device status: {str(e)}")
            return None
        
    # last msg operations
    async def save_mqtt_last_msg(self, timestamp: datetime):
        """Persist most recent MQTT message timestamp"""
        await self.db.mqtt_status.update_one(
            {"_id": "tracker"},
            {"$set": {"last_msg": timestamp}},
            upsert=True
        )

    async def get_mqtt_last_msg(self) -> Optional[datetime]:
        """Load persisted last_msg from database"""
        data = await self.db.mqtt_status.find_one({"_id": "tracker"})
        return data.get("last_msg") if data else None

    # GPS Location operations
    async def save_gps_location(self, location: GpsLocation) -> str:
        """Save GPS location to database"""
        try:
            result = await self.db.gps_locations.insert_one(location.dict())
            logger.info(f"Saved GPS location with ID: {result.inserted_id}")
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Error saving GPS location: {str(e)}")
            raise

    async def get_latest_gps_location(self) -> Optional[Dict[str, Any]]:
        """Get the most recent GPS location"""
        try:
            location = await self.db.gps_locations.find_one(
                sort=[("timestamp", -1)]
            )
            if location:
                location['_id'] = str(location['_id'])
            return location
        except Exception as e:
            logger.error(f"Error getting GPS location: {str(e)}")
            return None

    async def get_location_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get GPS location history"""
        try:
            cursor = self.db.gps_locations.find().sort("timestamp", -1).limit(limit)
            locations = await cursor.to_list(length=limit)
            
            for location in locations:
                location['_id'] = str(location['_id'])
                
            return locations
        except Exception as e:
            logger.error(f"Error getting location history: {str(e)}")
            return []

    # Led config operations
    async def save_led_config(self, led_config: LedConfig) -> str:
        """Save led config to database"""
        try:
            result = await self.db.led_config.insert_one(led_config.dict())
            logger.info(f"Saved led config with ID: {result.inserted_id}")
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Error saving led config: {str(e)}")
            raise

    async def get_led_config(self) -> Optional[Dict[str, Any]]:
        """Get the most recent led config"""
        try:
            led_config = await self.db.led_config.find_one(
                sort=[("timestamp", -1)]
            )
            if led_config:
                led_config['_id'] = str(led_config['_id'])
            return led_config
        except Exception as e:
            logger.error(f"Error getting led config: {str(e)}")
            return None
        
    # Config operations
    async def save_device_config(self, config: DeviceSettings) -> str:
        """Save device config to database"""
        try:
            result = await self.db.config.insert_one(config.dict())
            logger.info(f"Saved device config with ID: {result.inserted_id}")
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Error saving device config: {str(e)}")
            raise

    async def get_device_config(self) -> Optional[Dict[str, Any]]:
        """Get the most recent device config"""
        try:
            config = await self.db.config.find_one(
                sort=[("timestamp", -1)]
            )
            if config:
                config['_id'] = str(config['_id'])
            return config
        except Exception as e:
            logger.error(f"Error getting device config: {str(e)}")
            return None

    # Contact operations
    async def create_contact(self, contact: Contact) -> str:
        """Create a new contact"""
        try:
            result = await self.db.contacts.insert_one(contact.dict())
            logger.info(f"Created contact with ID: {result.inserted_id}")
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Error creating contact: {str(e)}")
            raise

    async def get_all_contacts(self) -> List[Dict[str, Any]]:
        """Get all contacts"""
        try:
            cursor = self.db.contacts.find().sort("name", 1)
            contacts = await cursor.to_list(length=None)
            
            for contact in contacts:
                contact['_id'] = str(contact['_id'])
                
            return contacts
        except Exception as e:
            logger.error(f"Error getting contacts: {str(e)}")
            return []

    async def get_contact_by_id(self, contact_id: str) -> Optional[Dict[str, Any]]:
        """Get contact by ID"""
        try:
            contact = await self.db.contacts.find_one({"id": contact_id})
            if contact:
                contact['_id'] = str(contact['_id'])
            return contact
        except Exception as e:
            logger.error(f"Error getting contact: {str(e)}")
            return None

    async def update_contact(self, contact_id: str, update_data: Dict[str, Any]) -> bool:
        """Update contact"""
        try:
            result = await self.db.contacts.update_one(
                {"id": contact_id}, 
                {"$set": update_data}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error updating contact: {str(e)}")
            return False

    async def delete_contact(self, contact_id: str) -> bool:
        """Delete contact"""
        try:
            result = await self.db.contacts.delete_one({"id": contact_id})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting contact: {str(e)}")
            return False

    # SMS operations
    async def save_sms_message(self, sms: SmsMessage) -> str:
        """Save SMS message to database"""
        try:
            result = await self.db.sms_history.insert_one(sms.dict())
            logger.info(f"Saved SMS message with ID: {result.inserted_id}")
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Error saving SMS message: {str(e)}")
            raise

    async def get_sms_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get SMS history"""
        try:
            cursor = self.db.sms_history.find().sort("timestamp", -1).limit(limit)
            messages = await cursor.to_list(length=limit)
            
            for message in messages:
                message['_id'] = str(message['_id'])
                
            return messages
        except Exception as e:
            logger.error(f"Error getting SMS history: {str(e)}")
            return []

    # Notification operations
    async def save_notification(self, notification: Notification) -> str:
        """Save notification to database"""
        try:
            result = await self.db.notifications.insert_one(notification.dict())
            logger.info(f"Saved notification with ID: {result.inserted_id}")
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Error saving notification: {str(e)}")
            raise

    async def get_notifications(self, limit: int = 50, unread_only: bool = False) -> List[Dict[str, Any]]:
        """Get notifications"""
        try:
            query = {"read": False} if unread_only else {}
            cursor = self.db.notifications.find(query).sort("timestamp", -1).limit(limit)
            notifications = await cursor.to_list(length=limit)
            
            for notification in notifications:
                notification['_id'] = str(notification['_id'])
                
            return notifications
        except Exception as e:
            logger.error(f"Error getting notifications: {str(e)}")
            return []

    async def mark_notification_read(self, notification_id: str) -> bool:
        """Mark notification as read"""
        try:
            result = await self.db.notifications.update_one(
                {"id": notification_id},
                {"$set": {"read": True}}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error marking notification as read: {str(e)}")
            return False

    async def get_unread_notification_count(self) -> int:
        """Get count of unread notifications"""
        try:
            count = await self.db.notifications.count_documents({"read": False})
            return count
        except Exception as e:
            logger.error(f"Error getting unread notification count: {str(e)}")
            return 0

    async def save_push_token(self, token: str, device_id: str, user_id: str):
        """Save or update a push token for a device"""
        existing = await self.push_tokens_collection.find_one({"device_id": device_id})
        if existing:
            await self.push_tokens_collection.update_one(
                {"device_id": device_id},
                {"$set": {"token": token, "user_id": user_id, "updated_at": datetime.utcnow()}}
            )
        else:
            await self.push_tokens_collection.insert_one({
                "token": token,
                "device_id": device_id,
                "user_id": user_id,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })


# Global database manager instance
db_manager = DatabaseManager()