from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class DeviceStatus(BaseModel):
    send_reason: int
    screen_on: bool
    sleep_mode: bool
    currently_active: bool
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
    prd_eps: bool
    gps_fix: bool
    prd_wakeup_counter: int
    temp_contact: str
    build: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class GpsLocation(BaseModel):
    send_reason: int
    send_reason_gps: Optional[int] = 0
    send_reason_lbs: Optional[int] = 0
    prd_wakeup_num: int
    gps_lat: float
    gps_lon: float
    lbs_lat: float
    lbs_lon: float
    sats: int
    alt: float
    speed: float
    course: float
    gps_fix: bool
    lbs_fix: bool
    gps_timestamp: datetime = Field(default_factory=datetime.utcnow)
    lbs_timestamp: datetime = Field(default_factory=datetime.utcnow)

class CallStatus(BaseModel):
    call_status: int
    number: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class LedConfig(BaseModel):
    red: int = Field(ge=0, le=255)
    green: int = Field(ge=0, le=255)
    blue: int = Field(ge=0, le=255)
    enableled: bool
    led_boot_ani: int
    led_call_ani: int
    led_noti_ani: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class DeviceConfig(BaseModel):
    callmode: int
    gpsmode: int
    bootanimation: bool
    enablebuzzer: bool
    enablehaptics: bool
    bootsms: bool
    noti_sound: bool
    noti_ppp: bool
    ringtone: int
    sms_thru_mqtt: bool
    DS_call_mode: int
    prd_wakeup: bool
    prd_wakeup_time: int
    prd_sms_intvrl: int
    prd_mqtt_intvrl:int
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
    type: str
    data: Optional[dict] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)