// API endpoints
export const API_ENDPOINTS = {
  PROJECTS: '/api/projects',
  USERS: '/api/users',
  FIBER_ROUTES: '/api/fiber-routes',
  SITE_SURVEYS: '/api/site-surveys',
  FORMS: '/api/forms',
  PHOTOS: '/api/photos',
  WEATHER: '/api/weather'
} as const;

// App configuration
export const APP_CONFIG = {
  MAX_PHOTO_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_PHOTOS_PER_SURVEY: 20,
  OFFLINE_SYNC_INTERVAL: 30000, // 30 seconds
  GPS_ACCURACY_THRESHOLD: 10, // meters
  MAP_DEFAULT_ZOOM: 15
} as const;

// Status colors
export const STATUS_COLORS = {
  NOT_STARTED: '#6B7280',
  IN_PROGRESS: '#3B82F6',
  COMPLETED: '#10B981',
  ON_HOLD: '#F59E0B',
  BLOCKED: '#EF4444'
} as const;

// Form validation
export const VALIDATION_RULES = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PROJECT_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_NOTES_LENGTH: 1000
} as const;
