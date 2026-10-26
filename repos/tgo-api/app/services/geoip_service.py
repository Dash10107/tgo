"""GeoIP service for IP to location lookup.

Supports two providers:
1. geoip2 (MaxMind GeoLite2) - International coverage, requires GeoLite2-City.mmdb
2. ip2region (lionsoul2014) - Better for China, requires ip2region.xdb

See: https://github.com/lionsoul2014/ip2region
"""

from dataclasses import dataclass
from typing import Optional
import os

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("services.geoip")

# Try to import geoip2
try:
    import geoip2.database
    import geoip2.errors
    GEOIP2_AVAILABLE = True
except ImportError:
    GEOIP2_AVAILABLE = False

# Try to import ip2region (official py-ip2region package v3+)
# See: https://pypi.org/project/py-ip2region/
try:
    import ip2region.searcher as xdb_searcher
    import ip2region.util as xdb_util
    IP2REGION_AVAILABLE = True
except ImportError:
    IP2REGION_AVAILABLE = False


@dataclass
class GeoLocation:
    """Geolocation data derived from an IP address."""
    
    country: Optional[str] = None
    country_code: Optional[str] = None
    region: Optional[str] = None
    city: Optional[str] = None
    isp: Optional[str] = None  # Only available with ip2region
    
    def is_empty(self) -> bool:
        """Check if all fields are empty."""
        return not any([self.country, self.country_code, self.region, self.city])


class GeoIPService:
    """Service for looking up geolocation data from IP addresses.
    
    Supports two providers:
    - geoip2: MaxMind GeoLite2 database
    - ip2region: lionsoul2014's ip2region database (better for China)
    """
    
    def __init__(self):
        self._geoip2_reader: Optional["geoip2.database.Reader"] = None
        # ip2region uses separate databases for IPv4 and IPv6
        self._ip2region_searcher_v4: Optional[xdb_searcher.Searcher] = None
        self._ip2region_searcher_v6: Optional[xdb_searcher.Searcher] = None
        self._initialized = False
        self._init_error: Optional[str] = None
        self._provider: Optional[str] = None
    
    def _ensure_initialized(self) -> bool:
        """Lazy initialization of the GeoIP database reader."""
        if self._initialized:
            has_ip2region = self._ip2region_searcher_v4 is not None or self._ip2region_searcher_v6 is not None
            return self._geoip2_reader is not None or has_ip2region
        
        self._initialized = True
        
        if not settings.GEOIP_ENABLED:
            self._init_error = "GeoIP is disabled in settings"
            return False
        
        db_path = settings.GEOIP_DATABASE_PATH
        if not db_path:
            self._init_error = "GEOIP_DATABASE_PATH not configured"
            logger.info("GeoIP database path not configured. IP geolocation disabled.")
            return False
        
        provider = settings.GEOIP_PROVIDER.lower()
        self._provider = provider
        
        if provider == "ip2region":
            return self._init_ip2region(db_path)
        elif provider == "geoip2":
            if not os.path.exists(db_path):
                self._init_error = f"GeoIP database file not found: {db_path}"
                logger.warning(f"GeoIP database file not found: {db_path}")
                return False
            return self._init_geoip2(db_path)
        else:
            self._init_error = f"Unknown GeoIP provider: {provider}"
            logger.error(f"Unknown GeoIP provider: {provider}. Supported: 'geoip2', 'ip2region'")
            return False
    
    def _init_ip2region(self, db_path: str) -> bool:
        """Initialize ip2region searcher.
        
        ip2region uses separate databases for IPv4 and IPv6.
        db_path can be:
        - A single file path (will auto-detect version from filename)
        - A directory containing ip2region_v4.xdb and/or ip2region_v6.xdb
        
        See: https://pypi.org/project/py-ip2region/
        """
        if not IP2REGION_AVAILABLE:
            self._init_error = "py-ip2region library not installed. Run: pip install py-ip2region"
            logger.warning("py-ip2region library not installed. IP geolocation disabled.")
            return False
        
        loaded_any = False
        
        # Check if db_path is a directory
        if os.path.isdir(db_path):
            # Look for v4 and v6 xdb files in the directory
            v4_path = os.path.join(db_path, "ip2region_v4.xdb")
            v6_path = os.path.join(db_path, "ip2region_v6.xdb")
            
            if os.path.exists(v4_path):
                if self._load_ip2region_db(v4_path, xdb_util.IPv4, "IPv4"):
                    loaded_any = True
            
            if os.path.exists(v6_path):
                if self._load_ip2region_db(v6_path, xdb_util.IPv6, "IPv6"):
                    loaded_any = True
        else:
            # Single file - detect version from filename
            if not os.path.exists(db_path):
                self._init_error = f"ip2region database file not found: {db_path}"
                logger.warning(f"ip2region database file not found: {db_path}")
                return False
            
            # Determine IP version from filename
            filename = os.path.basename(db_path).lower()
            if "v6" in filename or "ipv6" in filename:
                if self._load_ip2region_db(db_path, xdb_util.IPv6, "IPv6"):
                    loaded_any = True
            else:
                # Default to IPv4
                if self._load_ip2region_db(db_path, xdb_util.IPv4, "IPv4"):
                    loaded_any = True
        
        if not loaded_any:
            self._init_error = "Failed to load any ip2region database"
            return False
        
        return True
    
    def _load_ip2region_db(self, db_path: str, version: int, version_name: str) -> bool:
        """Load a single ip2region database file."""
        try:
            # Load entire xdb into memory for best performance and thread-safety
            # Note: load_content_from_file is in util module, not searcher
            searcher = xdb_searcher.new_with_file_only(xdb_util.Version(version), db_path)
            
            if version == xdb_util.IPv4:
                self._ip2region_searcher_v4 = searcher
            else:
                self._ip2region_searcher_v6 = searcher
            
            logger.info(f"ip2region {version_name} database loaded from {db_path}")
            return True
        except Exception as e:
            logger.warning(f"Failed to load ip2region {version_name} database from {db_path}: {e}")
            return False
    
    def _init_geoip2(self, db_path: str) -> bool:
        """Initialize geoip2 reader."""
        if not GEOIP2_AVAILABLE:
            self._init_error = "geoip2 library not installed. Run: pip install geoip2"
            logger.warning("geoip2 library not installed. IP geolocation disabled.")
            return False
        
        try:
            self._geoip2_reader = geoip2.database.Reader(db_path)
            logger.info(f"GeoIP2 database loaded successfully from {db_path}")
            return True
        except Exception as e:
            self._init_error = f"Failed to load GeoIP2 database: {e}"
            logger.error(f"Failed to load GeoIP2 database: {e}")
            return False
    
    def lookup(self, ip_address: Optional[str]) -> GeoLocation:
        """
        Look up geolocation data for an IP address.
        
        Args:
            ip_address: The IP address to look up (IPv4 or IPv6)
            
        Returns:
            GeoLocation with available data, or empty GeoLocation if lookup fails
        """
        if not ip_address:
            return GeoLocation()
        
        if not self._ensure_initialized():
            return GeoLocation()
        
        # Skip private/local IP addresses
        if self._is_private_ip(ip_address):
            return GeoLocation()
        
        if self._provider == "ip2region":
            has_searcher = self._ip2region_searcher_v4 or self._ip2region_searcher_v6
            if has_searcher:
                return self._lookup_ip2region(ip_address)
        elif self._provider == "geoip2" and self._geoip2_reader:
            return self._lookup_geoip2(ip_address)
        
        return GeoLocation()
    
    def _is_ipv6(self, ip_address: str) -> bool:
        """Check if an IP address is IPv6."""
        return ":" in ip_address
    
    def _lookup_ip2region(self, ip_address: str) -> GeoLocation:
        """Lookup using ip2region."""
        try:
            # Select the appropriate searcher based on IP version
            is_v6 = self._is_ipv6(ip_address)
            
            if is_v6:
                searcher = self._ip2region_searcher_v6
                if not searcher:
                    logger.debug(f"No IPv6 searcher available for {ip_address}")
                    return GeoLocation()
            else:
                searcher = self._ip2region_searcher_v4
                if not searcher:
                    logger.debug(f"No IPv4 searcher available for {ip_address}")
                    return GeoLocation()
            
            result = searcher.search(ip_address)
            if not result:
                return GeoLocation()
            
            # ip2region format can vary:
            # - Standard: country|region|province|city|ISP (5 parts)
            # - Simplified: country|province|city|ISP (4 parts)
            # Example (5 parts): China|0|Guangdong|Shenzhen|Telecom (the xdb database stores these in Chinese)
            # Example (4 parts): China|Guangdong|Shenzhen|Telecom
            parts = result.split("|")
            
            if len(parts) == 5:
                country = parts[0] if parts[0] != "0" else None
                # parts[1] is usually "0" (reserved/area), skipping it as requested
                region = parts[2] if parts[2] != "0" else None
                city = parts[3] if parts[3] != "0" else None
                isp = parts[4] if parts[4] != "0" else None
            elif len(parts) == 4:
                country = parts[0] if parts[0] != "0" else None
                region = parts[1] if parts[1] != "0" else None
                city = parts[2] if parts[2] != "0" else None
                isp = parts[3] if parts[3] != "0" else None
            else:
                # Fallback for other lengths (e.g., v1 format was 5 parts)
                country = parts[0] if len(parts) > 0 and parts[0] != "0" else None
                region = parts[2] if len(parts) > 2 and parts[2] != "0" else None
                city = parts[3] if len(parts) > 3 and parts[3] != "0" else None
                isp = parts[4] if len(parts) > 4 and parts[4] != "0" else None
            
            # Generate country code for common countries
            country_code = self._get_country_code(country)
            
            return GeoLocation(
                country=self._get_country_name(country),
                country_code=country_code,
                region=region,
                city=city,
                isp=isp,
            )
        except Exception as e:
            logger.warning(f"ip2region lookup failed for {ip_address}: {e}")
            return GeoLocation()
    
    def _lookup_geoip2(self, ip_address: str) -> GeoLocation:
        """Lookup using geoip2."""
        try:
            response = self._geoip2_reader.city(ip_address)
            
            return GeoLocation(
                country=response.country.name,
                country_code=response.country.iso_code,
                region=response.subdivisions.most_specific.name if response.subdivisions else None,
                city=response.city.name,
            )
        except geoip2.errors.AddressNotFoundError:
            logger.debug(f"IP address not found in GeoIP database: {ip_address}")
            return GeoLocation()
        except Exception as e:
            logger.warning(f"GeoIP2 lookup failed for {ip_address}: {e}")
            return GeoLocation()
    
    # ip2region stores country names in Chinese (written as unicode escapes): name -> (ISO code, English name)
    _COUNTRY_INFO = {
        "\u4e2d\u56fd": ("CN", "China"),
        "\u7f8e\u56fd": ("US", "United States"),
        "\u65e5\u672c": ("JP", "Japan"),
        "\u97e9\u56fd": ("KR", "South Korea"),
        "\u82f1\u56fd": ("GB", "United Kingdom"),
        "\u5fb7\u56fd": ("DE", "Germany"),
        "\u6cd5\u56fd": ("FR", "France"),
        "\u4fc4\u7f57\u65af": ("RU", "Russia"),
        "\u52a0\u62ff\u5927": ("CA", "Canada"),
        "\u6fb3\u5927\u5229\u4e9a": ("AU", "Australia"),
        "\u65b0\u52a0\u5761": ("SG", "Singapore"),
        "\u5370\u5ea6": ("IN", "India"),
        "\u5df4\u897f": ("BR", "Brazil"),
        "\u610f\u5927\u5229": ("IT", "Italy"),
        "\u897f\u73ed\u7259": ("ES", "Spain"),
        "\u8377\u5170": ("NL", "Netherlands"),
        "\u745e\u58eb": ("CH", "Switzerland"),
        "\u745e\u5178": ("SE", "Sweden"),
        "\u632a\u5a01": ("NO", "Norway"),
        "\u4e39\u9ea6": ("DK", "Denmark"),
        "\u82ac\u5170": ("FI", "Finland"),
        "\u6ce2\u5170": ("PL", "Poland"),
        "\u5965\u5730\u5229": ("AT", "Austria"),
        "\u6bd4\u5229\u65f6": ("BE", "Belgium"),
        "\u7231\u5c14\u5170": ("IE", "Ireland"),
        "\u65b0\u897f\u5170": ("NZ", "New Zealand"),
        "\u58a8\u897f\u54e5": ("MX", "Mexico"),
        "\u963f\u6839\u5ef7": ("AR", "Argentina"),
        "\u667a\u5229": ("CL", "Chile"),
        "\u5357\u975e": ("ZA", "South Africa"),
        "\u57c3\u53ca": ("EG", "Egypt"),
        "\u571f\u8033\u5176": ("TR", "Turkey"),
        "\u4ee5\u8272\u5217": ("IL", "Israel"),
        "\u963f\u8054\u914b": ("AE", "United Arab Emirates"),
        "\u6c99\u7279\u963f\u62c9\u4f2f": ("SA", "Saudi Arabia"),
        "\u6cf0\u56fd": ("TH", "Thailand"),
        "\u8d8a\u5357": ("VN", "Vietnam"),
        "\u9a6c\u6765\u897f\u4e9a": ("MY", "Malaysia"),
        "\u5370\u5ea6\u5c3c\u897f\u4e9a": ("ID", "Indonesia"),
        "\u83f2\u5f8b\u5bbe": ("PH", "Philippines"),
        "\u4e2d\u56fd\u53f0\u6e7e": ("TW", "Taiwan"),
        "\u53f0\u6e7e": ("TW", "Taiwan"),
        "\u4e2d\u56fd\u9999\u6e2f": ("HK", "Hong Kong"),
        "\u9999\u6e2f": ("HK", "Hong Kong"),
        "\u4e2d\u56fd\u6fb3\u95e8": ("MO", "Macau"),
        "\u6fb3\u95e8": ("MO", "Macau"),
        }

    def _get_country_code(self, country: Optional[str]) -> Optional[str]:
        """Get ISO country code from country name (for ip2region)."""
        if not country:
            return None
        
        # Common country name to code mapping
        country_info = self._COUNTRY_INFO
        info = country_info.get(country)
        return info[0] if info else None

    def _get_country_name(self, country: Optional[str]) -> Optional[str]:
        """Translate a country name from the ip2region database (Chinese) to English."""
        if not country:
            return None
        info = self._COUNTRY_INFO.get(country)
        return info[1] if info else country
    
    def _is_private_ip(self, ip_address: str) -> bool:
        """Check if an IP address is private/local."""
        # Simple check for common private IP ranges
        private_prefixes = (
            "10.",
            "172.16.", "172.17.", "172.18.", "172.19.",
            "172.20.", "172.21.", "172.22.", "172.23.",
            "172.24.", "172.25.", "172.26.", "172.27.",
            "172.28.", "172.29.", "172.30.", "172.31.",
            "192.168.",
            "127.",
            "localhost",
            "::1",
            "fe80:",  # Link-local IPv6
        )
        return ip_address.startswith(private_prefixes)
    
    def close(self):
        """Close the database reader."""
        if self._geoip2_reader:
            self._geoip2_reader.close()
            self._geoip2_reader = None
        if self._ip2region_searcher_v4:
            self._ip2region_searcher_v4.close()
            self._ip2region_searcher_v4 = None
        if self._ip2region_searcher_v6:
            self._ip2region_searcher_v6.close()
            self._ip2region_searcher_v6 = None
    
    @property
    def is_available(self) -> bool:
        """Check if GeoIP lookup is available."""
        return self._ensure_initialized()
    
    @property
    def provider(self) -> Optional[str]:
        """Get the current provider name."""
        self._ensure_initialized()
        return self._provider
    
    @property
    def status(self) -> str:
        """Get the current status of the GeoIP service."""
        if not self._initialized:
            self._ensure_initialized()
        
        has_ip2region = self._ip2region_searcher_v4 is not None or self._ip2region_searcher_v6 is not None
        if self._geoip2_reader is not None or has_ip2region:
            details = []
            if self._ip2region_searcher_v4:
                details.append("IPv4")
            if self._ip2region_searcher_v6:
                details.append("IPv6")
            if self._geoip2_reader:
                details.append("geoip2")
            return f"ready ({self._provider}: {', '.join(details)})"
        return self._init_error or "not initialized"


# Global singleton instance
geoip_service = GeoIPService()
