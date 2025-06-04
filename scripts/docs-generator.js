#!/usr/bin/env node

/**
 * API Documentation Generator
 * Automatically generates comprehensive API documentation from code
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const swaggerJSDoc = require('swagger-jsdoc');

// Configuration
const config = {
  apiDir: path.join(__dirname, '../apps/web/src/app/api'),
  outputDir: path.join(__dirname, '../docs/api'),
  specFile: path.join(__dirname, '../docs/api/openapi.yaml'),
  htmlFile: path.join(__dirname, '../docs/api/index.html'),
  markdownFile: path.join(__dirname, '../docs/api/README.md'),
  postmanFile: path.join(
    __dirname,
    '../docs/api/constructtrack.postman_collection.json'
  ),
};

// Swagger/OpenAPI configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ConstructTrack API',
      version: '1.0.0',
      description: 'Fiber Optic Construction Management Platform API',
      contact: {
        name: 'ConstructTrack Development Team',
        email: 'dev@constructtrack.com',
        url: 'https://constructtrack.com',
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC',
      },
    },
    servers: [
      {
        url: 'https://constructtrack.vercel.app/api/v1',
        description: 'Production server',
      },
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            code: {
              type: 'string',
              description: 'Error code',
            },
            details: {
              type: 'object',
              description: 'Additional error details',
            },
          },
          required: ['error'],
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
              description: 'Response data',
            },
            message: {
              type: 'string',
              description: 'Success message',
            },
          },
          required: ['success'],
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization',
      },
      {
        name: 'Users',
        description: 'User management operations',
      },
      {
        name: 'Projects',
        description: 'Project management operations',
      },
      {
        name: 'Tasks',
        description: 'Task management operations',
      },
      {
        name: 'Reports',
        description: 'Reporting and analytics',
      },
      {
        name: 'Files',
        description: 'File upload and management',
      },
      {
        name: 'Monitoring',
        description: 'System monitoring and metrics',
      },
      {
        name: 'Security',
        description: 'Security and compliance operations',
      },
    ],
  },
  apis: [
    path.join(config.apiDir, '**/*.ts'),
    path.join(__dirname, '../apps/web/src/lib/api/**/*.ts'),
    path.join(__dirname, '../docs/api/schemas/*.yaml'),
  ],
};

class DocumentationGenerator {
  constructor() {
    this.ensureDirectories();
  }

  // Ensure output directories exist
  ensureDirectories() {
    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
    }

    const schemasDir = path.join(config.outputDir, 'schemas');
    if (!fs.existsSync(schemasDir)) {
      fs.mkdirSync(schemasDir, { recursive: true });
    }
  }

  // Generate OpenAPI specification
  async generateOpenAPISpec() {
    console.log('📚 Generating OpenAPI specification...');

    try {
      const specs = swaggerJSDoc(swaggerOptions);

      // Write YAML file
      const yaml = require('js-yaml');
      const yamlStr = yaml.dump(specs, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
      });

      fs.writeFileSync(config.specFile, yamlStr);
      console.log('✅ OpenAPI YAML generated:', config.specFile);

      // Write JSON file for tools that prefer JSON
      const jsonFile = config.specFile.replace('.yaml', '.json');
      fs.writeFileSync(jsonFile, JSON.stringify(specs, null, 2));
      console.log('✅ OpenAPI JSON generated:', jsonFile);

      return specs;
    } catch (error) {
      console.error('❌ Failed to generate OpenAPI spec:', error);
      throw error;
    }
  }

  // Generate HTML documentation
  async generateHTMLDocs() {
    console.log('🌐 Generating HTML documentation...');

    try {
      // Use Redoc to generate HTML documentation
      execSync(
        `npx @redocly/cli build-docs "${config.specFile}" --output "${config.outputDir}"`,
        {
          stdio: 'inherit',
          timeout: 30000,
        }
      );
      console.log('✅ HTML documentation generated:', config.htmlFile);
    } catch (error) {
      console.error('❌ Failed to generate HTML docs:', error);
      throw error;
    }
  }

  // Generate Markdown documentation
  async generateMarkdownDocs(specs) {
    console.log('📝 Generating Markdown documentation...');

    const markdown = this.createMarkdownFromSpec(specs);
    fs.writeFileSync(config.markdownFile, markdown);
    console.log('✅ Markdown documentation generated:', config.markdownFile);
  }

  // Create Markdown content from OpenAPI spec
  createMarkdownFromSpec(specs) {
    let markdown = `# ConstructTrack API Documentation

${specs.info.description}

**Version:** ${specs.info.version}  
**Contact:** ${specs.info.contact.email}

## Base URLs

`;

    // Add servers
    specs.servers.forEach(server => {
      markdown += `- **${server.description}**: \`${server.url}\`\n`;
    });

    markdown += `
## Authentication

This API uses Bearer token authentication. Include your JWT token in the Authorization header:

\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

Alternatively, you can use API key authentication:

\`\`\`
X-API-Key: <your-api-key>
\`\`\`

## Endpoints

`;

    // Add endpoints
    if (specs.paths) {
      Object.entries(specs.paths).forEach(([path, methods]) => {
        markdown += `### ${path}\n\n`;

        Object.entries(methods).forEach(([method, operation]) => {
          if (typeof operation === 'object' && operation.summary) {
            markdown += `#### ${method.toUpperCase()} ${path}\n\n`;
            markdown += `${operation.summary}\n\n`;

            if (operation.description) {
              markdown += `${operation.description}\n\n`;
            }

            // Add parameters
            if (operation.parameters && operation.parameters.length > 0) {
              markdown += `**Parameters:**\n\n`;
              operation.parameters.forEach(param => {
                markdown += `- \`${param.name}\` (${param.in}) - ${param.description || 'No description'}\n`;
              });
              markdown += '\n';
            }

            // Add request body
            if (operation.requestBody) {
              markdown += `**Request Body:**\n\n`;
              markdown += `\`\`\`json\n${JSON.stringify(operation.requestBody, null, 2)}\n\`\`\`\n\n`;
            }

            // Add responses
            if (operation.responses) {
              markdown += `**Responses:**\n\n`;
              Object.entries(operation.responses).forEach(
                ([code, response]) => {
                  markdown += `- \`${code}\` - ${response.description || 'No description'}\n`;
                }
              );
              markdown += '\n';
            }

            markdown += '---\n\n';
          }
        });
      });
    }

    markdown += `
## Error Handling

All API endpoints return errors in the following format:

\`\`\`json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional error details"
  }
}
\`\`\`

## Rate Limiting

API requests are rate limited to prevent abuse:

- **Authentication endpoints**: 5 requests per 15 minutes
- **General API endpoints**: 100 requests per 15 minutes
- **Upload endpoints**: 10 requests per minute
- **Search endpoints**: 30 requests per minute

Rate limit headers are included in responses:

- \`X-RateLimit-Limit\`: Request limit per window
- \`X-RateLimit-Remaining\`: Remaining requests in current window
- \`X-RateLimit-Reset\`: Time when the rate limit resets

## SDKs and Tools

- [Postman Collection](./constructtrack.postman_collection.json)
- [OpenAPI Specification](./openapi.yaml)
- [Interactive API Explorer](./index.html)

## Support

For API support, please contact:
- Email: ${specs.info.contact.email}
- Documentation: ${specs.info.contact.url}
`;

    return markdown;
  }

  // Generate Postman collection
  async generatePostmanCollection(specs) {
    console.log('📮 Generating Postman collection...');

    const collection = {
      info: {
        name: 'ConstructTrack API',
        description: specs.info.description,
        version: specs.info.version,
        schema:
          'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      auth: {
        type: 'bearer',
        bearer: [
          {
            key: 'token',
            value: '{{jwt_token}}',
            type: 'string',
          },
        ],
      },
      variable: [
        {
          key: 'base_url',
          value: 'http://localhost:3000/api/v1',
          type: 'string',
        },
        {
          key: 'jwt_token',
          value: '',
          type: 'string',
        },
      ],
      item: [],
    };

    // Convert OpenAPI paths to Postman requests
    if (specs.paths) {
      Object.entries(specs.paths).forEach(([path, methods]) => {
        const folder = {
          name: path.split('/')[1] || 'Root',
          item: [],
        };

        Object.entries(methods).forEach(([method, operation]) => {
          if (typeof operation === 'object' && operation.summary) {
            const request = {
              name: operation.summary,
              request: {
                method: method.toUpperCase(),
                header: [
                  {
                    key: 'Content-Type',
                    value: 'application/json',
                  },
                ],
                url: {
                  raw: `{{base_url}}${path}`,
                  host: ['{{base_url}}'],
                  path: path.split('/').filter(Boolean),
                },
                description: operation.description,
              },
            };

            // Add request body for POST/PUT/PATCH
            if (
              ['post', 'put', 'patch'].includes(method) &&
              operation.requestBody
            ) {
              request.request.body = {
                mode: 'raw',
                raw: JSON.stringify({}, null, 2),
                options: {
                  raw: {
                    language: 'json',
                  },
                },
              };
            }

            folder.item.push(request);
          }
        });

        if (folder.item.length > 0) {
          collection.item.push(folder);
        }
      });
    }

    fs.writeFileSync(config.postmanFile, JSON.stringify(collection, null, 2));
    console.log('✅ Postman collection generated:', config.postmanFile);
  }

  // Validate generated documentation
  async validateDocumentation() {
    console.log('🔍 Validating documentation...');

    try {
      // Validate OpenAPI spec
      execSync(`npx swagger-cli validate "${config.specFile}"`, {
        stdio: 'inherit',
        timeout: 15000,
      });
      console.log('✅ OpenAPI specification is valid');

      // Check if HTML file was generated
      if (fs.existsSync(config.htmlFile)) {
        console.log('✅ HTML documentation exists');
      } else {
        throw new Error('HTML documentation not found');
      }

      // Check if Markdown file was generated
      if (fs.existsSync(config.markdownFile)) {
        console.log('✅ Markdown documentation exists');
      } else {
        throw new Error('Markdown documentation not found');
      }

      return true;
    } catch (error) {
      console.error('❌ Documentation validation failed:', error);
      return false;
    }
  }

  // Generate all documentation
  async generateAll() {
    try {
      console.log('🚀 Starting API documentation generation...');

      const specs = await this.generateOpenAPISpec();
      await this.generateHTMLDocs();
      await this.generateMarkdownDocs(specs);
      await this.generatePostmanCollection(specs);

      const isValid = await this.validateDocumentation();

      if (isValid) {
        console.log('🎉 API documentation generated successfully!');
        console.log(`📁 Documentation available at: ${config.outputDir}`);
      } else {
        throw new Error('Documentation validation failed');
      }
    } catch (error) {
      console.error('❌ Documentation generation failed:', error);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const generator = new DocumentationGenerator();
  generator.generateAll();
}

module.exports = DocumentationGenerator;
