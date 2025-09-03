import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from typing import List, Optional, Dict, Any
from datetime import datetime
from models import DeviceStatus, GpsLocation, Contacts, LedConfig, DeviceSettings, SmsMessage

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
        """Save led config"""
        try:
            result = await self.db.led_config.update_one(
                {},
                {"$set": led_config.dict()},
                upsert=True
            )
            logger.info("LED config saved/updated")
            return "updated" if result.modified_count > 0 else "inserted"
        except Exception as e:
            logger.error(f"Error saving led config: {str(e)}")
            raise

    async def get_led_config(self) -> Optional[Dict[str, Any]]:
        """Get led config"""
        try:
            led_config = await self.db.led_config.find_one({})
            if led_config:
                led_config["_id"] = str(led_config["_id"])
            return led_config
        except Exception as e:
            logger.error(f"Error getting led config: {str(e)}")
            return None
          
    # Config operations
    async def save_device_config(self, config: DeviceSettings) -> str:
        """Save device config"""
        try:
            result = await self.db.config.update_one(
                {},
                {"$set": config.dict()},
                upsert=True
            )
            logger.info("Device config saved/updated")
            return "updated" if result.modified_count > 0 else "inserted"
        except Exception as e:
            logger.error(f"Error saving device config: {str(e)}")
            raise

    async def get_device_config(self) -> Optional[Dict[str, Any]]:
        """Get device config"""
        try:
            config = await self.db.config.find_one({})
            if config:
                config["_id"] = str(config["_id"])
            return config
        except Exception as e:
            logger.error(f"Error getting device config: {str(e)}")
            return None

    # Contact operations
    async def save_contacts(self, contacts: Contacts) -> str:
        """Save or update contacts (only one document in collection)"""
        try:
            result = await self.db.contacts.update_one(
                {},  # match any existing doc
                {"$set": contacts.dict()},
                upsert=True
            )
            logger.info("Contacts saved/updated")
            return "updated" if result.modified_count > 0 else "inserted"
        except Exception as e:
            logger.error(f"Error saving contacts: {str(e)}")
            raise

    async def get_contacts(self) -> Optional[Dict[str, Any]]:
        """Get the single contacts list"""
        try:
            contacts = await self.db.contacts.find_one({})
            if contacts:
                contacts["_id"] = str(contacts["_id"])
            return contacts
        except Exception as e:
            logger.error(f"Error getting contacts: {str(e)}")
            return None


    # SMS operations
    async def save_sms(self, sms: SmsMessage) -> str:
        """Save or update SMS (only one message stored)"""
        try:
            result = await self.db.sms.update_one(
                {},  # always overwrite the single doc
                {"$set": sms.dict()},
                upsert=True
            )
            logger.info("SMS saved/updated")
            return "updated" if result.modified_count > 0 else "inserted"
        except Exception as e:
            logger.error(f"Error saving sms: {str(e)}")
            raise

    async def get_sms(self) -> Optional[Dict[str, Any]]:
        """Get the single SMS"""
        try:
            sms = await self.db.sms.find_one({})
            if sms:
                sms["_id"] = str(sms["_id"])
            return sms
        except Exception as e:
            logger.error(f"Error getting sms: {str(e)}")
            return None


    # FCM Token operations
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

    async def get_push_tokens(self, user_id: str) -> list:
        """Retrieve all push tokens for a given user"""
        try:
            tokens_cursor = self.push_tokens_collection.find({"user_id": user_id})
            tokens = [t["token"] for t in await tokens_cursor.to_list(length=100)]
            return tokens
        except Exception as e:
            logger.error(f"Failed to retrieve push tokens for user {user_id}: {str(e)}")
            return []


# Global database manager instance
db_manager = DatabaseManager()