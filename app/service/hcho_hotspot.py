import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any
from app.services.data_ingestion import DataIngestionService, CPCB_STATIONS
from app.utils.geo_helpers import haversine_distance

class HCHOHotspotService:
    def __init__(self, ingestion_service: DataIngestionService):
        self.ingestion = ingestion_service

    def detect_hotspots(self, date_str: str) -> Dict[str, Any]:
        """
        Processes HCHO and MODIS fire counts.
        - Identifies hotspots using statistical thresholding (cells with HCHO >= 85th percentile).
        - Clusters contiguous cells.
        - Correlates hotspots with fire radiative power.
        - Computes wind transport trajectories.
        """
        sat_data = self.ingestion.fetch_satellite_data(date_str)
        met_data = self.ingestion.fetch_meteorology(date_str)
        fires = self.ingestion.fetch_fire_counts(date_str)

        # Index meteorology by coordinates
        met_dict = {(round(m["lat"], 2), round(m["lon"], 2)): m for m in met_data}

        # 1. Statistical threshold for hotspots
        hcho_vals = [s["hcho"] for s in sat_data]
        threshold = float(np.percentile(hcho_vals, 85))  # 85th percentile is the hotspot boundary

        hotspot_cells = []
        for s in sat_data:
            if s["hcho"] >= threshold:
                lat, lon = s["lat"], s["lon"]
                met = met_dict.get((round(lat, 2), round(lon, 2)))
                
                # Check for nearby fires (within 100km)
                nearby_fires = 0
                total_frp = 0.0
                for f in fires:
                    dist = haversine_distance(lat, lon, f["lat"], f["lon"])
                    if dist <= 100.0:
                        nearby_fires += 1
                        total_frp += f["frp"]

                hotspot_cells.append({
                    "lat": lat,
                    "lon": lon,
                    "hcho": s["hcho"],
                    "nearby_fires": nearby_fires,
                    "frp": float(total_frp),
                    "wind_u": met["wind_u"] if met else 0.0,
                    "wind_v": met["wind_v"] if met else 0.0,
                    "wind_speed": met["wind_speed"] if met else 0.0
                })

        # 2. Innovative Clustering: Contiguous region grouping
        # Group nearby cells into "Hotspot Regions" (e.g. Indo-Gangetic Plain, Punjab Agricultural Zone)
        clusters = self._cluster_hotspots(hotspot_cells)

        # 3. Transport dispersion modeling: trace wind plumes from hotspot centroids
        plumes = self._trace_wind_plumes(clusters, date_str)

        return {
            "threshold": threshold,
            "hotspot_cells": hotspot_cells,
            "hotspot_regions": clusters,
            "plumes": plumes,
            "fires": fires
        }

    def _cluster_hotspots(self, cells: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Performs spatial grouping (clustering) on hotspot cells.
        Groups cells within 2.5 degrees of each other and names them by geographic location.
        """
        if not cells:
            return []

        unvisited = list(cells)
        clusters = []
        cluster_id = 0

        while unvisited:
            # Start a new cluster
            current = unvisited.pop(0)
            cluster_cells = [current]
            
            # Find all cells within 2.5 degrees (Euclidean distance proxy for close grids)
            i = 0
            while i < len(cluster_cells):
                node = cluster_cells[i]
                neighbors = [
                    x for x in unvisited 
                    if np.sqrt((x["lat"] - node["lat"])**2 + (x["lon"] - node["lon"])**2) <= 2.5
                ]
                for n in neighbors:
                    cluster_cells.append(n)
                    unvisited.remove(n)
                i += 1
            
            # Compute cluster centroid
            c_lat = float(np.mean([c["lat"] for c in cluster_cells]))
            c_lon = float(np.mean([c["lon"] for c in cluster_cells]))
            avg_hcho = float(np.mean([c["hcho"] for c in cluster_cells]))
            avg_frp = float(np.sum([c["frp"] for c in cluster_cells]))
            
            # Assign standard region names based on centroid coordinates
            if 29 <= c_lat <= 32 and 74 <= c_lon <= 77:
                name = "Punjab-Haryana Agricultural Burning Zone"
            elif 24 <= c_lat <= 28 and 77 <= c_lon <= 86:
                name = "Indo-Gangetic Plain (IGP) Hotspot"
            elif 20 <= c_lat <= 24 and 80 <= c_lon <= 85:
                name = "Central Indian Forest Fire Zone"
            elif 22 <= c_lat <= 26 and 90 <= c_lon <= 97:
                name = "Northeast India Forest Fire Zone"
            else:
                name = f"Hotspot Cluster #{cluster_id + 1} (Lat: {round(c_lat,1)}, Lon: {round(c_lon,1)})"
                
            clusters.append({
                "cluster_id": cluster_id,
                "name": name,
                "lat": c_lat,
                "lon": c_lon,
                "avg_hcho": avg_hcho,
                "total_frp": avg_frp,
                "cell_count": len(cluster_cells)
            })
            cluster_id += 1

        return sorted(clusters, key=lambda x: x["avg_hcho"], reverse=True)

    def _trace_wind_plumes(self, clusters: List[Dict[str, Any]], date_str: str) -> List[Dict[str, Any]]:
        """
        Methodological Innovation: Transport Dispersion Trajectory.
        Traces a 3-step downwind path from each cluster centroid using local wind vectors,
        identifying potential downwind cities/cpcb stations in the transport plume.
        """
        met_data = self.ingestion.fetch_meteorology(date_str)
        met_dict = {(round(m["lat"], 2), round(m["lon"], 2)): m for m in met_data}
        
        plumes = []
        for c in clusters:
            lat, lon = c["lat"], c["lon"]
            
            # Initialize path
            path = [{"lat": lat, "lon": lon}]
            curr_lat, curr_lon = lat, lon
            
            # Trace 3 hops downwind
            for _ in range(3):
                met = met_dict.get((round(curr_lat, 2), round(curr_lon, 2)))
                if not met:
                    # Fallback to nearest met
                    nearest_dist = float('inf')
                    for (g_lat, g_lon), m_val in met_dict.items():
                        d = haversine_distance(curr_lat, curr_lon, g_lat, g_lon)
                        if d < nearest_dist:
                            nearest_dist = d
                            met = m_val
                
                if met:
                    u, v = met["wind_u"], met["wind_v"]
                    # Convert wind speed (m/s) to delta lat/lon over 6 hours (rough proxy)
                    # 1 m/s = ~0.03 degrees per hour = ~0.2 degrees per 6h
                    delta_lon = u * 0.05
                    delta_lat = v * 0.05
                    
                    curr_lat = float(curr_lat + delta_lat)
                    curr_lon = float(curr_lon + delta_lon)
                    path.append({"lat": curr_lat, "lon": curr_lon})
                else:
                    break
            
            # Identify affected downwind CPCB stations
            impacted_stations = []
            end_lat, end_lon = path[-1]["lat"], path[-1]["lon"]
            for s in CPCB_STATIONS:
                # If station is near the transport path endpoint (within 150km)
                d = haversine_distance(end_lat, end_lon, s["lat"], s["lon"])
                if d <= 150.0 and s["name"] not in [x["name"] for x in impacted_stations]:
                    impacted_stations.append({
                        "name": s["name"],
                        "distance_km": round(d, 1)
                    })

            plumes.append({
                "cluster_id": c["cluster_id"],
                "name": c["name"],
                "path": path,
                "impacted_stations": impacted_stations
            })
            
        return plumes

    def get_historical_correlation(self) -> List[Dict[str, Any]]:
        """
        Retrieves temporal correlation stats between HCHO column densities
        and active fire counts over a simulated 12-month period to highlight
        the seasonal biomess-burning coupling.
        """
        months_data = []
        base_date = datetime(2025, 1, 1)
        
        # Simulated correlation for 12 months showing high coupling in crop burning/forest fire months
        for i in range(12):
            dt = base_date + timedelta(days=i*30)
            month_name = dt.strftime("%B")
            month = dt.month
            
            # Setup fire count & HCHO averages for this month
            if month in [10, 11]:  # Crop residue burning
                fires = np.random.randint(4000, 8000)
                hcho = 0.00038
                r_val = 0.88  # Very high correlation
            elif month in [3, 4, 5]:  # Forest fires
                fires = np.random.randint(2500, 4500)
                hcho = 0.00028
                r_val = 0.76
            else:  # Monsoon / clean months
                fires = np.random.randint(100, 500)
                hcho = 0.00011
                r_val = 0.25  # Low background correlation
                
            months_data.append({
                "month": month_name,
                "month_num": month,
                "fire_count": fires,
                "avg_hcho": hcho,
                "pearson_r": r_val
            })
            
        return months_data
