/**
 * Test Utilities for ConstructTrack
 * Common utilities and helpers for all test types
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import userEvent from '@testing-library/user-event';

// Mock implementations
export const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChange: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  })),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(),
      download: jest.fn(),
      remove: jest.fn(),
    })),
  },
};

export const mockMapboxGL = {
  Map: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    addSource: jest.fn(),
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
    removeSource: jest.fn(),
    setCenter: jest.fn(),
    setZoom: jest.fn(),
    fitBounds: jest.fn(),
    remove: jest.fn(),
  })),
  Marker: jest.fn(() => ({
    setLngLat: jest.fn().mockReturnThis(),
    addTo: jest.fn().mockReturnThis(),
    remove: jest.fn(),
  })),
  Popup: jest.fn(() => ({
    setLngLat: jest.fn().mockReturnThis(),
    setHTML: jest.fn().mockReturnThis(),
    addTo: jest.fn().mockReturnThis(),
    remove: jest.fn(),
  })),
};

// Test data factories
export const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'field_worker',
  organization_id: 'org-123',
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

export const createMockProject = (overrides = {}) => ({
  id: 'project-123',
  name: 'Test Fiber Project',
  description: 'Test project description',
  status: 'active',
  organization_id: 'org-123',
  created_by: 'user-123',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

export const createMockTask = (overrides = {}) => ({
  id: 'task-123',
  title: 'Test Task',
  description: 'Test task description',
  status: 'pending',
  priority: 'medium',
  project_id: 'project-123',
  assigned_to: 'user-123',
  created_by: 'user-123',
  due_date: '2024-12-31T23:59:59Z',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

export const createMockLocation = (overrides = {}) => ({
  latitude: 40.7128,
  longitude: -74.0060,
  address: '123 Test Street, New York, NY',
  ...overrides,
});

// Custom render function with providers
export const renderWithProviders = (ui, options = {}) => {
  const {
    initialState = {},
    ...renderOptions
  } = options;

  // Mock providers wrapper
  const Wrapper = ({ children }) => {
    return (
      <div data-testid="test-wrapper">
        {children}
      </div>
    );
  };

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Async utilities
export const waitForLoadingToFinish = () => {
  return waitFor(() => {
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
  });
};

export const waitForErrorToAppear = () => {
  return waitFor(() => {
    expect(screen.getByTestId('error')).toBeInTheDocument();
  });
};

// Form testing utilities
export const fillForm = async (formData) => {
  const user = userEvent.setup();
  
  for (const [fieldName, value] of Object.entries(formData)) {
    const field = screen.getByLabelText(new RegExp(fieldName, 'i'));
    await user.clear(field);
    await user.type(field, value);
  }
};

export const submitForm = async () => {
  const user = userEvent.setup();
  const submitButton = screen.getByRole('button', { name: /submit/i });
  await user.click(submitButton);
};

// API mocking utilities
export const mockApiResponse = (data, status = 200) => {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
};

export const mockApiError = (message = 'API Error', status = 500) => {
  return Promise.reject({
    status,
    message,
    response: {
      status,
      data: { error: message },
    },
  });
};

// Local storage mocking
export const mockLocalStorage = () => {
  const store = {};
  
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
  };
};

// Geolocation mocking
export const mockGeolocation = () => {
  const mockGeolocation = {
    getCurrentPosition: jest.fn(),
    watchPosition: jest.fn(),
    clearWatch: jest.fn(),
  };

  Object.defineProperty(global.navigator, 'geolocation', {
    value: mockGeolocation,
    writable: true,
  });

  return mockGeolocation;
};

// File upload testing
export const createMockFile = (name = 'test.jpg', type = 'image/jpeg', size = 1024) => {
  const file = new File(['test content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

export const uploadFile = async (inputElement, file) => {
  const user = userEvent.setup();
  await user.upload(inputElement, file);
};

// Date/time utilities
export const mockDate = (dateString) => {
  const mockDate = new Date(dateString);
  jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
  return mockDate;
};

export const restoreDate = () => {
  global.Date.mockRestore();
};

// Network request mocking
export const mockFetch = (responses = []) => {
  let callCount = 0;
  
  global.fetch = jest.fn(() => {
    const response = responses[callCount] || responses[responses.length - 1];
    callCount++;
    return Promise.resolve(response);
  });
};

export const restoreFetch = () => {
  global.fetch.mockRestore();
};

// Performance testing utilities
export const measurePerformance = async (fn) => {
  const start = performance.now();
  await fn();
  const end = performance.now();
  return end - start;
};

// Accessibility testing utilities
export const checkAccessibility = async (container) => {
  const { axe } = await import('jest-axe');
  const results = await axe(container);
  expect(results).toHaveNoViolations();
};

// Error boundary testing
export const TestErrorBoundary = ({ children, onError }) => {
  try {
    return children;
  } catch (error) {
    if (onError) onError(error);
    return <div data-testid="error-boundary">Something went wrong</div>;
  }
};

// Custom matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Cleanup utilities
export const cleanup = () => {
  jest.clearAllMocks();
  restoreDate();
  restoreFetch();
};

// Export all testing library utilities
export * from '@testing-library/react';
export { userEvent };
export { jest };
