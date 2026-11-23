from datetime import datetime, time, timedelta, timezone
from math import asin, cos, radians, sin, sqrt


WIB = timezone(timedelta(hours=7))


def is_time_between(current_time: time, start_time: time, end_time: time) -> bool:
    return start_time <= current_time <= end_time


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    # Great-circle distance in meters.
    radius_earth = 6371000

    d_lat = radians(lat2 - lat1)
    d_lon = radians(lon2 - lon1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    c = 2 * asin(sqrt(a))

    return radius_earth * c


def current_local_datetime() -> datetime:
    return datetime.now(WIB).replace(tzinfo=None)
