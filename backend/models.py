from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class DeviceStatus(BaseModel):
    send_reason: int
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
    stored_sms: int
    prd_eps: Optional[bool] = None
    last_activity_human: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class GpsLocation(BaseModel):
    send_reason: int
    gps_lat: float
    gps_lon: float
    lbs_lat: float
    lbs_lon: float
    sats: int
    alt: float
    speed: float
    course: float
    lbs_age: Optional[str] = None  # Store as ISO string
    gps_age: Optional[str] = None  # Store as ISO string
    lbs_age_human: Optional[str] = None
    gps_age_human: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class CallStatus(BaseModel):
    status: int = Field(ge=0, le=3)
    number: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class LedConfig(BaseModel):
    red: int = Field(ge=0, le=255)
    green: int = Field(ge=0, le=255)
    blue: int = Field(ge=0, le=255)
    enableled: bool
    led_boot_ani: Optional[int] = Field(default=None, ge=0, le=10)
    led_call_ani: Optional[int] = Field(default=None, ge=0, le=10)
    led_noti_ani: Optional[int] = Field(default=None, ge=0, le=10)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class DeviceConfig(BaseModel):
    callmode: Optional[int] = Field(default=None, ge=0, le=2)
    gpsmode: Optional[int] = Field(default=None, ge=0, le=9)
    bootanimation: Optional[bool] = None
    enablebuzzer: Optional[bool] = None
    enablehaptics: Optional[bool] = None
    bootsms: Optional[bool] = None
    noti_sound: Optional[bool] = None
    noti_ppp: Optional[bool] = None
    ringtone: Optional[int] = Field(default=None, ge=0, le=24)
    sms_thru_mqtt: Optional[bool] = None
    DS_call_mode: Optional[int] = Field(default=None, ge=0, le=3)
    prd_wakeup: Optional[bool] = None
    prd_wakeup_time: Optional[int] = Field(default=None, ge=5, le=28800)
    prd_sms_intvrl: Optional[int] = Field(default=None, ge=0, le=10)
    prd_mqtt_intvrl: Optional[int] = Field(default=None, ge=0, le=10)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class Contacts(BaseModel):
    nam1: str
    num1: str
    nam2: str
    num2: str
    nam3: str
    num3: str
    nam4: str
    num4: str
    nam5: str
    num5: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class SmsMessage(BaseModel):
    number: str
    message: str
    time_sent: Optional[str] = None
    time_sent_human: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class Notification(BaseModel):
    title: str
    message: str
    type: str  # 'status', 'location', 'sms', 'call', 'system'
    data: Optional[dict] = None

class PushTokenRegister(BaseModel):
    token: str
    deviceId: str
    userId: str