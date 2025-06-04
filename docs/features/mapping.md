# 🗺️ Mapping & GIS Features

> **Comprehensive guide to ConstructTrack's mapping and geospatial capabilities**

ConstructTrack provides advanced mapping features specifically designed for fiber optic installation
projects, built on MapBox GL JS with PostGIS backend support.

## 🎯 Overview

### Core Mapping Features

- **Interactive Fiber Route Visualization**: Real-time display of fiber optic cables and
  infrastructure
- **GPS-Enabled Field Tools**: Mobile mapping for field workers
- **Offline Map Support**: Work without internet connectivity
- **Geospatial Data Management**: PostGIS-powered spatial queries
- **Custom Styling**: Industry-specific map themes and symbols

### Technology Stack

- **MapBox GL JS**: Web mapping engine
- **React Native MapBox SDK**: Mobile mapping
- **PostGIS**: Geospatial database extension
- **Supabase**: Real-time geospatial data sync

## 🗺️ Interactive Map Interface

### Basic Map Setup

```typescript
import { Map, Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

function ProjectMap({ project }) {
  return (
    <Map
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
      initialViewState={{
        longitude: project.location.coordinates[0],
        latitude: project.location.coordinates[1],
        zoom: 14
      }}
      style={{ width: '100%', height: '400px' }}
      mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
    >
      {/* Fiber routes layer */}
      <Source id="fiber-routes" type="geojson" data={fiberRoutesData}>
        <Layer
          id="fiber-routes-layer"
          type="line"
          paint={{
            'line-color': '#ff6b35',
            'line-width': 3,
            'line-opacity': 0.8
          }}
        />
      </Source>
    </Map>
  );
}
```

### Map Controls

```typescript
import { NavigationControl, ScaleControl, GeolocateControl } from 'react-map-gl';

function MapControls() {
  return (
    <>
      <NavigationControl position="top-right" />
      <ScaleControl position="bottom-left" />
      <GeolocateControl
        position="top-right"
        trackUserLocation={true}
        showUserHeading={true}
      />
    </>
  );
}
```

## 🛣️ Fiber Route Management

### Creating Fiber Routes

```typescript
interface FiberRoute {
  id: string;
  name: string;
  project_id: string;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  properties: {
    fiber_count: number;
    cable_type: 'single_mode' | 'multi_mode';
    installation_method: 'aerial' | 'underground' | 'buried';
    status: 'planned' | 'in_progress' | 'completed';
  };
}

// Create new fiber route
async function createFiberRoute(route: Omit<FiberRoute, 'id'>) {
  const { data, error } = await supabase.from('fiber_routes').insert([route]).select();

  if (error) throw error;
  return data[0];
}
```

### Route Visualization

```typescript
function FiberRouteLayer({ routes }) {
  const routeData = {
    type: 'FeatureCollection',
    features: routes.map(route => ({
      type: 'Feature',
      geometry: route.geometry,
      properties: {
        id: route.id,
        status: route.properties.status,
        fiber_count: route.properties.fiber_count
      }
    }))
  };

  return (
    <Source id="fiber-routes" type="geojson" data={routeData}>
      <Layer
        id="fiber-routes-planned"
        type="line"
        filter={['==', ['get', 'status'], 'planned']}
        paint={{
          'line-color': '#94a3b8',
          'line-width': 2,
          'line-dasharray': [2, 2]
        }}
      />
      <Layer
        id="fiber-routes-active"
        type="line"
        filter={['==', ['get', 'status'], 'in_progress']}
        paint={{
          'line-color': '#f59e0b',
          'line-width': 3
        }}
      />
      <Layer
        id="fiber-routes-completed"
        type="line"
        filter={['==', ['get', 'status'], 'completed']}
        paint={{
          'line-color': '#10b981',
          'line-width': 3
        }}
      />
    </Source>
  );
}
```

## 📍 Work Area Management

### Polygon Drawing Tools

```typescript
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

function WorkAreaDrawing({ onAreaCreated }) {
  const [draw, setDraw] = useState(null);

  useEffect(() => {
    const drawInstance = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true
      },
      defaultMode: 'draw_polygon'
    });

    setDraw(drawInstance);

    return () => {
      if (drawInstance) {
        drawInstance.deleteAll();
      }
    };
  }, []);

  const handleDrawCreate = useCallback((event) => {
    const { features } = event;
    if (features.length > 0) {
      onAreaCreated(features[0]);
    }
  }, [onAreaCreated]);

  return (
    <div>
      {draw && (
        <div className="mapbox-gl-draw_ctrl-group mapbox-gl-draw_ctrl">
          <button
            className="mapbox-gl-draw_ctrl-draw-btn mapbox-gl-draw_polygon"
            onClick={() => draw.changeMode('draw_polygon')}
            title="Draw work area"
          />
        </div>
      )}
    </div>
  );
}
```

### Geofencing for Mobile

```typescript
// Mobile geofencing implementation
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const GEOFENCE_TASK = 'geofence-task';

// Define geofence regions
async function setupGeofencing(workAreas: WorkArea[]) {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return;

  const regions = workAreas.map(area => ({
    identifier: area.id,
    latitude: area.center.latitude,
    longitude: area.center.longitude,
    radius: area.radius,
    notifyOnEnter: true,
    notifyOnExit: true,
  }));

  await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
}

// Handle geofence events
TaskManager.defineTask(GEOFENCE_TASK, ({ data, error }) => {
  if (error) {
    console.error('Geofencing error:', error);
    return;
  }

  if (data.eventType === Location.GeofencingEventType.Enter) {
    console.log('Entered work area:', data.region.identifier);
    // Trigger work area entry actions
  } else if (data.eventType === Location.GeofencingEventType.Exit) {
    console.log('Exited work area:', data.region.identifier);
    // Trigger work area exit actions
  }
});
```

## 📸 GPS Photo Mapping

### Photo Geotagging

```typescript
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

async function captureGeotaggedPhoto() {
  // Get current location
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  // Capture photo
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.8,
    exif: true,
  });

  if (!result.canceled) {
    const photo = {
      uri: result.assets[0].uri,
      location: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: new Date().toISOString(),
      },
      exif: result.assets[0].exif,
    };

    return photo;
  }
}
```

### Photo Map Markers

```typescript
function PhotoMarkers({ photos }) {
  return (
    <>
      {photos.map(photo => (
        <Marker
          key={photo.id}
          longitude={photo.location.longitude}
          latitude={photo.location.latitude}
        >
          <div className="photo-marker">
            <img
              src={photo.thumbnail_url}
              alt="Progress photo"
              className="w-8 h-8 rounded-full border-2 border-white shadow-lg"
              onClick={() => openPhotoModal(photo)}
            />
          </div>
        </Marker>
      ))}
    </>
  );
}
```

## 🔍 Geospatial Queries

### PostGIS Integration

```sql
-- Find projects within radius
SELECT p.*,
       ST_Distance(p.location, ST_Point($1, $2)::geography) as distance
FROM projects p
WHERE ST_DWithin(p.location, ST_Point($1, $2)::geography, $3)
ORDER BY distance;

-- Find fiber routes intersecting with work area
SELECT fr.*
FROM fiber_routes fr, work_areas wa
WHERE ST_Intersects(fr.geometry, wa.geometry)
  AND wa.id = $1;

-- Calculate total fiber length in project
SELECT project_id,
       SUM(ST_Length(geometry::geography)) as total_length_meters
FROM fiber_routes
WHERE project_id = $1
GROUP BY project_id;
```

### Spatial Queries in Application

```typescript
// Find nearby projects
async function findNearbyProjects(lat: number, lng: number, radius: number) {
  const { data, error } = await supabase.rpc('find_nearby_projects', {
    lat,
    lng,
    radius_meters: radius,
  });

  return data;
}

// Get projects within bounds
async function getProjectsInBounds(bounds: MapBounds) {
  const { data, error } = await supabase.rpc('projects_in_bounds', {
    min_lat: bounds.south,
    max_lat: bounds.north,
    min_lng: bounds.west,
    max_lng: bounds.east,
  });

  return data;
}
```

## 📱 Mobile Mapping Features

### React Native MapBox Setup

```typescript
import MapboxGL from '@rnmapbox/maps';

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN);

function MobileMap({ project }) {
  return (
    <MapboxGL.MapView
      style={{ flex: 1 }}
      styleURL={MapboxGL.StyleURL.SatelliteStreet}
    >
      <MapboxGL.Camera
        centerCoordinate={project.location.coordinates}
        zoomLevel={14}
      />

      <MapboxGL.ShapeSource id="fiber-routes" shape={fiberRoutesGeoJSON}>
        <MapboxGL.LineLayer
          id="fiber-routes-layer"
          style={{
            lineColor: '#ff6b35',
            lineWidth: 3,
            lineOpacity: 0.8
          }}
        />
      </MapboxGL.ShapeSource>
    </MapboxGL.MapView>
  );
}
```

### Offline Map Caching

```typescript
// Download offline map region
async function downloadOfflineRegion(bounds: MapBounds, name: string) {
  const offlineRegion = await MapboxGL.offlineManager.createPack({
    name,
    styleURL: MapboxGL.StyleURL.SatelliteStreet,
    bounds: [
      [bounds.west, bounds.south],
      [bounds.east, bounds.north],
    ],
    minZoom: 10,
    maxZoom: 16,
  });

  return offlineRegion;
}

// List offline regions
async function getOfflineRegions() {
  const regions = await MapboxGL.offlineManager.getPacks();
  return regions;
}
```

## 🎨 Custom Map Styling

### Fiber Industry Styling

```typescript
const fiberMapStyle = {
  version: 8,
  sources: {
    'fiber-infrastructure': {
      type: 'geojson',
      data: fiberInfrastructureGeoJSON,
    },
  },
  layers: [
    {
      id: 'fiber-cables-underground',
      type: 'line',
      source: 'fiber-infrastructure',
      filter: ['==', ['get', 'installation_method'], 'underground'],
      paint: {
        'line-color': '#3b82f6',
        'line-width': 2,
        'line-pattern': 'underground-pattern',
      },
    },
    {
      id: 'fiber-cables-aerial',
      type: 'line',
      source: 'fiber-infrastructure',
      filter: ['==', ['get', 'installation_method'], 'aerial'],
      paint: {
        'line-color': '#ef4444',
        'line-width': 2,
      },
    },
  ],
};
```

## 📊 Performance Optimization

### Map Performance Best Practices

```typescript
// Cluster markers for better performance
function ClusteredMarkers({ points }) {
  const clusterOptions = {
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50
  };

  return (
    <Source
      id="clustered-points"
      type="geojson"
      data={pointsGeoJSON}
      {...clusterOptions}
    >
      <Layer
        id="clusters"
        type="circle"
        filter={['has', 'point_count']}
        paint={{
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#51bbd6',
            100,
            '#f1f075',
            750,
            '#f28cb1'
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            20,
            100,
            30,
            750,
            40
          ]
        }}
      />
    </Source>
  );
}
```

## 🎯 Usage Examples & Edge Cases

### Common Usage Patterns

#### 1. Project Boundary Validation

```typescript
// Validate if work location is within project boundary
function validateWorkLocation(workPoint: GeoPoint, projectBoundary: Polygon): boolean {
  try {
    const point = turf.point([workPoint.longitude, workPoint.latitude]);
    const polygon = turf.polygon(projectBoundary.coordinates);

    return turf.booleanPointInPolygon(point, polygon);
  } catch (error) {
    console.error('Boundary validation failed:', error);
    return false; // Fail safe - allow work if validation fails
  }
}

// Usage in component
const isValidLocation = useMemo(() => {
  if (!currentLocation || !project.boundary) return true;
  return validateWorkLocation(currentLocation, project.boundary);
}, [currentLocation, project.boundary]);
```

#### 2. Route Progress Calculation

```typescript
// Calculate completion percentage along fiber route
function calculateRouteProgress(completedSegments: LineString[], totalRoute: LineString): number {
  try {
    const totalLength = turf.length(totalRoute, { units: 'meters' });
    const completedLength = completedSegments.reduce((sum, segment) => {
      return sum + turf.length(segment, { units: 'meters' });
    }, 0);

    return Math.min((completedLength / totalLength) * 100, 100);
  } catch (error) {
    console.error('Progress calculation failed:', error);
    return 0;
  }
}
```

#### 3. Offline Map Handling

```typescript
// Handle offline map scenarios
function OfflineMapHandler({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineRegions, setOfflineRegions] = useState([]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const downloadOfflineRegion = async (bounds: MapBounds) => {
    try {
      const region = await MapboxGL.offlineManager.createPack({
        name: `project-${Date.now()}`,
        styleURL: MapboxGL.StyleURL.SatelliteStreet,
        bounds: [[bounds.west, bounds.south], [bounds.east, bounds.north]],
        minZoom: 10,
        maxZoom: 16
      });

      setOfflineRegions(prev => [...prev, region]);
      return region;
    } catch (error) {
      console.error('Failed to download offline region:', error);
      throw error;
    }
  };

  return (
    <MapContext.Provider value={{ isOnline, offlineRegions, downloadOfflineRegion }}>
      {children}
    </MapContext.Provider>
  );
}
```

### Edge Cases & Error Handling

#### 1. Invalid Coordinates

```typescript
// Validate and sanitize coordinates
function validateCoordinates(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !isNaN(lat) &&
    !isNaN(lng)
  );
}

function sanitizeGeoJSON(geojson: any): any {
  try {
    // Validate GeoJSON structure
    if (!geojson || !geojson.type) {
      throw new Error('Invalid GeoJSON: missing type');
    }

    // Recursively validate coordinates
    const validateGeometry = (geometry: any) => {
      if (geometry.type === 'Point') {
        const [lng, lat] = geometry.coordinates;
        if (!validateCoordinates(lat, lng)) {
          throw new Error(`Invalid coordinates: [${lng}, ${lat}]`);
        }
      } else if (geometry.type === 'LineString') {
        geometry.coordinates.forEach(([lng, lat]: number[]) => {
          if (!validateCoordinates(lat, lng)) {
            throw new Error(`Invalid coordinates in LineString: [${lng}, ${lat}]`);
          }
        });
      }
      // Add more geometry type validations as needed
    };

    if (geojson.type === 'Feature') {
      validateGeometry(geojson.geometry);
    } else if (geojson.type === 'FeatureCollection') {
      geojson.features.forEach((feature: any) => {
        validateGeometry(feature.geometry);
      });
    }

    return geojson;
  } catch (error) {
    console.error('GeoJSON validation failed:', error);
    return null;
  }
}
```

#### 2. Map Loading Failures

```typescript
// Robust map loading with fallbacks
function RobustMap({ fallbackStyle = 'mapbox://styles/mapbox/streets-v11', ...props }) {
  const [mapError, setMapError] = useState(null);
  const [currentStyle, setCurrentStyle] = useState(props.mapStyle);

  const handleMapError = useCallback((error) => {
    console.error('Map error:', error);
    setMapError(error);

    // Try fallback style
    if (currentStyle !== fallbackStyle) {
      console.log('Trying fallback map style...');
      setCurrentStyle(fallbackStyle);
      setMapError(null);
    }
  }, [currentStyle, fallbackStyle]);

  if (mapError && currentStyle === fallbackStyle) {
    return (
      <div className="map-error">
        <p>Map failed to load. Please check your internet connection.</p>
        <button onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <Map
      {...props}
      mapStyle={currentStyle}
      onError={handleMapError}
    />
  );
}
```

#### 3. GPS Accuracy Handling

```typescript
// Handle varying GPS accuracy levels
function useGPSLocation() {
  const [location, setLocation] = useState(null);
  const [accuracy, setAccuracy] = useState(null);

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      position => {
        const { latitude, longitude, accuracy } = position.coords;

        // Only update if accuracy is acceptable (within 50 meters)
        if (accuracy <= 50) {
          setLocation({ latitude, longitude });
          setAccuracy(accuracy);
        } else {
          console.warn(`GPS accuracy too low: ${accuracy}m`);
        }
      },
      error => {
        console.error('GPS error:', error);
        // Handle different error types
        switch (error.code) {
          case error.PERMISSION_DENIED:
            alert('GPS permission denied. Please enable location access.');
            break;
          case error.POSITION_UNAVAILABLE:
            alert('GPS position unavailable. Please check your device settings.');
            break;
          case error.TIMEOUT:
            console.warn('GPS timeout, retrying...');
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return { location, accuracy };
}
```

## 📸 UI Screenshots & Visual Examples

> **Note**: Screenshots and GIFs would be added here in a real implementation. For now, we provide
> text descriptions of key visual elements:

### Key Visual Elements

1. **Interactive Map Interface**: Full-screen MapBox map with custom fiber industry styling
2. **Fiber Route Visualization**: Color-coded lines showing planned, in-progress, and completed
   routes
3. **Work Area Polygons**: Geofenced project boundaries with visual indicators
4. **GPS Photo Markers**: Thumbnail images positioned at exact GPS coordinates
5. **Mobile Map Controls**: Touch-optimized controls for field worker use
6. **Offline Map Indicators**: Visual cues showing downloaded offline regions

### Recommended Screenshots

- Project overview map with multiple fiber routes
- Mobile interface showing GPS tracking and photo capture
- Route drawing tools in action
- Offline map download interface
- Photo gallery with map integration

---

**Next**: Explore [Mobile App Features](mobile.md) and [Real-time Features](real-time.md) for more
platform-specific capabilities.
