/**
 * Validation Utility Functions
 * Common validation functions for the application
 */

/**
 * Validates email format
 * @param email - Email string to validate
 * @returns true if email is valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates latitude value
 * @param latitude - Latitude value to validate
 * @returns true if latitude is valid (-90 to 90), false otherwise
 */
export function isValidLatitude(latitude: number): boolean {
  return latitude >= -90 && latitude <= 90;
}

/**
 * Validates longitude value
 * @param longitude - Longitude value to validate
 * @returns true if longitude is valid (-180 to 180), false otherwise
 */
export function isValidLongitude(longitude: number): boolean {
  return longitude >= -180 && longitude <= 180;
}

/**
 * Validates coordinates object
 * @param coordinates - Object with latitude and longitude
 * @returns true if both coordinates are valid, false otherwise
 */
export function isValidCoordinates(coordinates: {
  latitude: number;
  longitude: number;
}): boolean {
  return (
    isValidLatitude(coordinates.latitude) &&
    isValidLongitude(coordinates.longitude)
  );
}

/**
 * Validates budget value
 * @param budget - Budget value to validate
 * @returns true if budget is positive, false otherwise
 */
export function isValidBudget(budget: number): boolean {
  return budget > 0;
}
