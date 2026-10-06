from dataclasses import dataclass

import httpx

GEOLOCATION_URL = "https://ipapi.co/{ip}/json/"
GEOLOCATION_TIMEOUT = 5.0


@dataclass(frozen=True)
class LocationData:
    country: str
    region: str
    city: str
    latitude: float
    longitude: float
    postal_code: str | None


def resolve_ip_location(ip_address: str) -> LocationData | None:
    if not ip_address or ip_address.startswith(("10.", "192.168.", "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.", "127.", "169.254.", "::1", "fc", "fd")):
        return None

    try:
        with httpx.Client(timeout=GEOLOCATION_TIMEOUT) as client:
            response = client.get(GEOLOCATION_URL.format(ip=ip_address), follow_redirects=False)
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        return None

    try:
        latitude = float(payload["latitude"])
        longitude = float(payload["longitude"])
    except (KeyError, TypeError, ValueError):
        return None

    return LocationData(
        country=str(payload.get("country_name", "")),
        region=str(payload.get("region", "")),
        city=str(payload.get("city", "")),
        latitude=latitude,
        longitude=longitude,
        postal_code=str(payload.get("postal") or None),
    )
