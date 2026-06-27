import numpy as np

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great-circle distance between two points 
    on the Earth in kilometers.
    """
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2)**2
    c = 2 * np.arcsin(np.sqrt(a))
    r = 6371.0 # Radius of Earth in kilometers
    return c * r

def generate_india_grid(resolution=1.0):
    """
    Generates a list of (lat, lon) coordinates covering India.
    India bounds roughly: Lat 8N to 37N, Lon 68E to 97E.
    Returns lat_coords, lon_coords, and flat grid coordinates.
    """
    lats = np.arange(8.0, 37.0 + resolution, resolution)
    lons = np.arange(68.0, 97.0 + resolution, resolution)
    
    grid = []
    for lat in lats:
        for lon in lons:
            # Basic polygon bounding mask for India
            if is_within_india_mask(lat, lon):
                grid.append({"lat": float(lat), "lon": float(lon)})
                
    return lats, lons, grid

def is_within_india_mask(lat, lon):
    """
    Rough polygonal representation of India to filter out ocean/other countries.
    This helps keep the grid visually aligned with India's landmass.
    """
    # Simple bounding boxes / trapezoids for landmass
    # South India (tapers down)
    if lat < 16:
        return 74 <= lon <= 80 + (lat - 8) * 0.5
    # East/Northeast (Sikkim/Assam region etc.) — must be checked before the general Central/North band
    elif 20 <= lat <= 28 and lon > 88:
        return 88 < lon <= 97
    # Central/North India
    elif 16 <= lat <= 25:
        return 69 <= lon <= 88
    # North India (Kashmir etc.)
    elif lat > 28:
        return 72 <= lon <= 80
    return False
