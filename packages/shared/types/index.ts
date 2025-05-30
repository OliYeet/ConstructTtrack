// Project types
export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  organization_id: string;
}

export enum ProjectStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ON_HOLD = 'on_hold'
}

// User types
export interface User {
  id: string;
  email: string;
  full_name?: string;
  role: UserRole;
  organization_id: string;
}

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  FIELD_WORKER = 'field_worker',
  VIEWER = 'viewer'
}

// Fiber network types
export interface FiberRoute {
  id: string;
  name: string;
  coordinates: GeoCoordinate[];
  project_id: string;
  status: RouteStatus;
}

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
  altitude?: number;
}

export enum RouteStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked'
}

// Site survey types
export interface SiteSurvey {
  id: string;
  project_id: string;
  location: GeoCoordinate;
  photos: string[];
  notes: string;
  completed_by: string;
  completed_at: string;
}

// Form types
export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  options?: string[];
}

export enum FieldType {
  TEXT = 'text',
  NUMBER = 'number',
  EMAIL = 'email',
  PHONE = 'phone',
  SELECT = 'select',
  CHECKBOX = 'checkbox',
  SIGNATURE = 'signature',
  PHOTO = 'photo',
  DATE = 'date'
}
