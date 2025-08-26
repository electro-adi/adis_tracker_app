from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid

# Device Status Models
class DeviceStatus(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    message: str
    screen_on: bool
    last_activity: str
    bat_voltage: float
    bat_percent: int
    gsm_rssi: int
    wifi_enabled: bool
    wifi_rssi: int
    wifi: str
    in_call: bool
    locked: bool
    light_level: int
    uptime: str
    espnow_state: int
    last_activity_human: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

model_config = {
    "validate_by_name": True
}

# GPS Location Models
class GpsLocation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    message: str
    gps_lat: float
    gps_lon: float
    lbs_lat: float
    lbs_lon: float
    sats: int
    alt: float
    speed: float
    course: float
    lbs_age: Optional[datetime] = None
    gps_age: Optional[datetime] = None
    lbs_age_human: Optional[str] = None
    gps_age_human: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

# Contact Models
class Contact(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    number: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ContactCreate(BaseModel):
    name: str
    number: str

class ContactUpdate(BaseModel):
    name: Optional[str] = None
    number: Optional[str] = None

class CallStatus(BaseModel):
    status: int = Field(ge=0, le=3)
    number: Optional[str] = None

# SMS Models
class SmsMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    number: str
    message: str
    type: str  # 'sent' or 'received'
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class SmsCreate(BaseModel):
    number: str
    sms: str

# Device Command Models
class LedConfig(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    red: int = Field(ge=0, le=255)
    green: int = Field(ge=0, le=255)
    blue: int = Field(ge=0, le=255)
    enableled: bool
    led_boot_ani: Optional[int] = Field(default=None, ge=0, le=10)
    led_call_ani: Optional[int] = Field(default=None, ge=0, le=10)
    led_noti_ani: Optional[int] = Field(default=None, ge=0, le=10)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class DeviceSettings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bootanimation: Optional[bool] = None
    enablebuzzer: Optional[bool] = None
    enablehaptics: Optional[bool] = None
    bootsms: Optional[bool] = None
    noti_sound: Optional[bool] = None
    noti_ppp: Optional[bool] = None
    ringtone: Optional[int] = Field(default=None, ge=0, le=24)
    prd_wakeup: Optional[bool] = None
    prd_wakeup_time: Optional[int] = Field(default=None, ge=60000)
    callmode: Optional[int] = Field(default=None, ge=0, le=2)
    gpsmode: Optional[int] = Field(default=None, ge=0, le=9)
    DS_call_mode: Optional[int] = Field(default=None, ge=0, le=3)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

# Notification Models
class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    message: str
    type: str  # 'status', 'location', 'sms', 'call', 'system'
    data: Optional[dict] = None
    read: bool = False
    timestamp: datetime = Field(default_factory=datetime.utcnow)

# MQTT Connection Status
class MqttStatus(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    connected: bool
    broker: str
    port: int
    last_connected: Optional[datetime] = None
    last_msg: Optional[datetime] = None
    last_msg_human: Optional[str] = None
    connection_attempts: int = 0
    timestamp: datetime = Field(default_factory=datetime.utcnow)