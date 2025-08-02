from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid

# Device Status Models
class DeviceStatus(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    message: str
    screen_on: bool
    last_activity: int
    bat_voltage: float
    bat_percent: int
    four_g_rssi: int = Field(alias='4g_rssi')
    wifi_enabled: bool
    wifi_rssi: int
    wifi: str
    in_call: bool
    locked: bool
    buzzer: bool
    vibrator: bool
    light_level: int
    stored_lat: float
    stored_lon: float
    uptime: str
    espnow_state: int
    callmode: int
    gpsmode: int
    bootanimation: bool
    enablebuzzer: bool
    enablehaptics: bool
    enableled: bool
    bootsms: bool
    noti_sound: bool
    noti_ppp: bool
    ringtone: int
    prd_wakeup: bool
    prd_wakeup_time: int
    DS_call_mode: int
    led_boot_ani: int
    led_call_ani: int
    led_noti_ani: int
    red: int
    green: int
    blue: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)

model_config = {
    "validate_by_name": True
}

# GPS Location Models
class GpsLocation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lat: float
    lon: float
    lbs_lat: float
    lbs_lon: float
    sats: int
    lbs_age: str
    gps_age: str
    alt: float
    speed: float
    course: float
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
    red: int = Field(ge=0, le=255)
    green: int = Field(ge=0, le=255)
    blue: int = Field(ge=0, le=255)
    led_boot_ani: Optional[int] = Field(default=None, ge=0, le=10)
    led_call_ani: Optional[int] = Field(default=None, ge=0, le=10)
    led_noti_ani: Optional[int] = Field(default=None, ge=0, le=10)

class DeviceSettings(BaseModel):
    bootanimation: Optional[bool] = None
    enablebuzzer: Optional[bool] = None
    enablehaptics: Optional[bool] = None
    enableled: Optional[bool] = None
    bootsms: Optional[bool] = None
    noti_sound: Optional[bool] = None
    noti_ppp: Optional[bool] = None
    ringtone: Optional[int] = Field(default=None, ge=0, le=24)
    prd_wakeup: Optional[bool] = None
    prd_wakeup_time: Optional[int] = Field(default=None, ge=60000)
    callmode: Optional[int] = Field(default=None, ge=0, le=2)
    gpsmode: Optional[int] = Field(default=None, ge=0, le=9)
    DS_call_mode: Optional[int] = Field(default=None, ge=0, le=3)

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
    connected: bool
    broker: str
    port: int
    last_connected: Optional[datetime] = None
    connection_attempts: int = 0