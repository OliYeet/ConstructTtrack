# JavaScript Examples

This guide provides JavaScript examples for integrating with the ConstructTrack API.

## Basic Setup

### Using Fetch API

```javascript
const API_BASE_URL = 'http://localhost:3001/api/v1';

class ConstructTrackAPI {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.accessToken = null;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Add authentication if available
    if (this.accessToken) {
      config.headers.Authorization = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!data.success) {
        throw new Error(`API Error: ${data.error.message} (${data.error.code})`);
      }

      return data.data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }

  // Test endpoints
  async test() {
    return this.request('/test');
  }

  async testPost(message, data = null) {
    return this.request('/test', {
      method: 'POST',
      body: JSON.stringify({ message, data }),
    });
  }

  // Authentication (when implemented)
  async login(email, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    this.accessToken = response.accessToken;
    return response;
  }

  // Projects
  async getProjects(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/projects?${queryString}` : '/projects';
    return this.request(endpoint);
  }

  async createProject(projectData) {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
  }

  async getProject(projectId) {
    return this.request(`/projects/${projectId}`);
  }

  async updateProject(projectId, updates) {
    return this.request(`/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteProject(projectId) {
    return this.request(`/projects/${projectId}`, {
      method: 'DELETE',
    });
  }
}
```

## Usage Examples

### Basic API Testing

```javascript
// Initialize the API client
const api = new ConstructTrackAPI();

// Test API connectivity
async function testConnectivity() {
  try {
    const health = await api.healthCheck();
    console.log('API Health:', health);

    const testResult = await api.test();
    console.log('Test Result:', testResult);

    const postResult = await api.testPost('Hello from JavaScript!', {
      timestamp: new Date().toISOString(),
      browser: navigator.userAgent,
    });
    console.log('POST Test Result:', postResult);
  } catch (error) {
    console.error('API test failed:', error);
  }
}

testConnectivity();
```

### Error Handling

```javascript
async function robustApiCall() {
  try {
    const result = await api.getProjects();
    return result;
  } catch (error) {
    // Handle specific error types
    if (error.message.includes('AUTHENTICATION_ERROR')) {
      console.log('Authentication failed, redirecting to login...');
      // Redirect to login page
      window.location.href = '/login';
    } else if (error.message.includes('RATE_LIMIT_EXCEEDED')) {
      console.log('Rate limited, retrying after delay...');
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, 5000));
      return robustApiCall();
    } else {
      console.error('Unexpected error:', error);
      throw error;
    }
  }
}
```

### Working with Projects

```javascript
async function projectManagement() {
  try {
    // Create a new project
    const newProject = await api.createProject({
      name: 'Fiber Installation - Downtown',
      description: 'Installing fiber optic cables in downtown area',
      startDate: '2024-01-15T09:00:00Z',
      endDate: '2024-03-15T17:00:00Z',
      budget: 50000,
      customerName: 'Downtown Business Association',
      customerEmail: 'contact@downtown.com',
      location: {
        latitude: 40.7128,
        longitude: -74.006,
      },
    });

    console.log('Created project:', newProject);

    // Get all projects with pagination
    const projects = await api.getProjects({
      page: 1,
      limit: 10,
      status: 'in_progress',
      sortBy: 'name',
      sortOrder: 'asc',
    });

    console.log('Projects:', projects);

    // Update project status
    const updatedProject = await api.updateProject(newProject.id, {
      status: 'completed',
      description: 'Project completed successfully',
    });

    console.log('Updated project:', updatedProject);
  } catch (error) {
    console.error('Project management failed:', error);
  }
}
```

## React Integration

### Custom Hook

```javascript
import { useState, useEffect } from 'react';

function useConstructTrackAPI() {
  const [api] = useState(() => new ConstructTrackAPI());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  const login = async (email, password) => {
    try {
      const response = await api.login(email, password);
      setUser(response.user);
      setIsAuthenticated(true);
      return response;
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
      throw error;
    }
  };

  const logout = () => {
    api.accessToken = null;
    setIsAuthenticated(false);
    setUser(null);
  };

  return {
    api,
    isAuthenticated,
    user,
    login,
    logout,
  };
}

// Usage in component
function ProjectList() {
  const { api, isAuthenticated } = useConstructTrackAPI();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchProjects() {
      if (!isAuthenticated) return;

      try {
        setLoading(true);
        const projectsData = await api.getProjects();
        setProjects(projectsData.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, [api, isAuthenticated]);

  if (loading) return <div>Loading projects...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Projects</h2>
      {projects.map(project => (
        <div key={project.id}>
          <h3>{project.name}</h3>
          <p>{project.description}</p>
          <span>Status: {project.status}</span>
        </div>
      ))}
    </div>
  );
}
```

### API Context Provider

```javascript
import React, { createContext, useContext, useState } from 'react';

const APIContext = createContext();

export function APIProvider({ children }) {
  const [api] = useState(() => new ConstructTrackAPI());
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const login = async (email, password) => {
    const response = await api.login(email, password);
    setUser(response.user);
    setIsAuthenticated(true);
    return response;
  };

  const logout = () => {
    api.accessToken = null;
    setUser(null);
    setIsAuthenticated(false);
  };

  const value = {
    api,
    user,
    isAuthenticated,
    login,
    logout,
  };

  return <APIContext.Provider value={value}>{children}</APIContext.Provider>;
}

export function useAPI() {
  const context = useContext(APIContext);
  if (!context) {
    throw new Error('useAPI must be used within an APIProvider');
  }
  return context;
}
```

## Node.js Server-Side

```javascript
const fetch = require('node-fetch');

class ConstructTrackServerAPI {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);
    const data = await response.json();

    if (!data.success) {
      throw new Error(`API Error: ${data.error.message}`);
    }

    return data.data;
  }

  async syncProjects() {
    return this.request('/projects');
  }

  async createProject(projectData) {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
  }
}

// Usage
const serverAPI = new ConstructTrackServerAPI(
  'https://api.constructtrack.com/v1',
  process.env.CONSTRUCTTRACK_API_KEY
);

async function syncData() {
  try {
    const projects = await serverAPI.syncProjects();
    console.log(`Synced ${projects.length} projects`);
  } catch (error) {
    console.error('Sync failed:', error);
  }
}
```

## Testing

```javascript
// Jest test example
describe('ConstructTrack API', () => {
  let api;

  beforeEach(() => {
    api = new ConstructTrackAPI('http://localhost:3001/api/v1');
  });

  test('should check API health', async () => {
    const health = await api.healthCheck();
    expect(health.status).toBe('healthy');
  });

  test('should handle test endpoint', async () => {
    const result = await api.test();
    expect(result.message).toBe('API is working correctly!');
  });

  test('should validate POST data', async () => {
    await expect(
      api.testPost('') // Empty message should fail
    ).rejects.toThrow('VALIDATION_ERROR');
  });
});
```

## Best Practices

1. **Always handle errors gracefully**
2. **Implement retry logic for transient failures**
3. **Use environment variables for API keys**
4. **Implement proper authentication token management**
5. **Add request/response logging for debugging**
6. **Use TypeScript for better type safety**

## TypeScript Version

```typescript
interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    statusCode: number;
  };
  meta: {
    timestamp: string;
    version: string;
    requestId: string;
  };
}

interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  startDate?: string;
  endDate?: string;
  budget?: number;
  location?: {
    latitude: number;
    longitude: number;
  };
}

class TypedConstructTrackAPI {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Implementation similar to JavaScript version
    // but with proper TypeScript types
  }

  async getProjects(): Promise<Project[]> {
    return this.request<Project[]>('/projects');
  }

  async createProject(project: Omit<Project, 'id'>): Promise<Project> {
    return this.request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
  }
}
```
