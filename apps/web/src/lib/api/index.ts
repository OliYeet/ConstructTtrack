/**
 * API Utilities Index
 * Central export for all API utilities and middleware
 */

// Middleware exports
export {
  withApiMiddleware,
  withAuth,
  withAdmin,
  withManager,
} from './middleware';

// Response utilities
export {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  createNoContentResponse,
  createCreatedResponse,
  createAcceptedResponse,
  createMethodNotAllowedResponse,
  createOptionsResponse,
  addCorsHeaders,
} from './response';

// Validation utilities
export {
  validateRequestBody,
  validateQueryParams,
  validatePathParams,
  extractPaginationParams,
  validateFileUpload,
  validateSearchQuery,
  sanitizeString,
  commonSchemas,
  constructTrackSchemas,
} from './validation';

// Authentication utilities
export {
  extractToken,
  verifyToken,
  createRequestContext,
  requireAuth,
  requireRole,
  requireOrganization,
  requireAdmin,
  requireManager,
  requireFieldWorker,
  canAccessResource,
  extractOrganizationId,
  validateOrganizationAccess,
  verifyApiKey,
} from './auth';

// Error classes
export {
  BaseApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalServerError,
  DatabaseError,
  ExternalServiceError,
  createValidationError,
  createNotFoundError,
  isApiError,
  isValidationError,
  ERROR_CODES,
} from '../errors/api-errors';

// Logger utilities
export {
  logger,
  logRequest,
  logResponse,
  logError,
  LogLevel,
} from './logger';

// Type exports
export type {
  ApiResponse,
  ApiError,
  PaginationParams,
  PaginatedResponse,
  RequestContext,
  ApiRequest,
  HttpMethod,
  ApiHandler,
  ValidationError as ValidationErrorType,
  RateLimitInfo,
  ApiConfig,
} from '../../types/api';
