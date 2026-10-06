from ipaddress import ip_address, ip_network
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp


def parse_trusted_proxy_hosts(value: str) -> list[ip_network]:
    networks: list[ip_network] = []
    for entry in value.split(","):
        entry = entry.strip()
        if not entry:
            continue
        try:
            networks.append(ip_network(entry, strict=False))
        except ValueError:
            try:
                networks.append(ip_network(f"{entry}/32", strict=False))
            except ValueError:
                continue
    return networks


def is_trusted_proxy(host: str, networks: list[ip_network]) -> bool:
    try:
        address = ip_address(host)
    except ValueError:
        return False
    return any(address in network for network in networks)


class TrustedProxyMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, trusted_hosts: str) -> None:
        super().__init__(app)
        self.trusted_networks = parse_trusted_proxy_hosts(trusted_hosts)

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        client_host = request.client.host if request.client else None
        if client_host and is_trusted_proxy(client_host, self.trusted_networks):
            forwarded = request.headers.get("x-forwarded-for")
            if forwarded:
                forwarded_host = forwarded.split(",", maxsplit=1)[0].strip()
                if forwarded_host:
                    request.scope["client"] = (forwarded_host, request.client.port)
        return await call_next(request)
