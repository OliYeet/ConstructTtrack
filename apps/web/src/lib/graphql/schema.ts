/**
 * GraphQL Schema Design for ConstructTrack API
 * Comprehensive schema covering all core entities and operations
 */

import { gql } from 'graphql-tag';

// Core scalar types
export const scalarTypes = gql`
  scalar DateTime
  scalar JSON
  scalar UUID
  scalar Geometry
  scalar Upload
`;

// Enums
export const enumTypes = gql`
  enum UserRole {
    ADMIN
    MANAGER
    FIELD_WORKER
    CUSTOMER
  }

  enum ProjectStatus {
    PLANNING
    IN_PROGRESS
    COMPLETED
    ON_HOLD
    CANCELLED
  }

  enum TaskStatus {
    NOT_STARTED
    IN_PROGRESS
    COMPLETED
    BLOCKED
  }

  enum FiberType {
    SINGLE_MODE
    MULTI_MODE
    ARMORED
    AERIAL
    UNDERGROUND
  }

  enum ConnectionStatus {
    PLANNED
    INSTALLED
    TESTED
    ACTIVE
    INACTIVE
  }

  enum EquipmentStatus {
    AVAILABLE
    IN_USE
    MAINTENANCE
    RETIRED
  }
`;

// Core types
export const coreTypes = gql`
  type Organization {
    id: UUID!
    name: String!
    slug: String!
    contactEmail: String
    contactPhone: String
    address: String
    settings: JSON
    createdAt: DateTime!
    updatedAt: DateTime!

    # Relations
    profiles: [Profile!]!
    projects: [Project!]!
    equipment: [Equipment!]!
  }

  type Profile {
    id: UUID!
    userId: UUID!
    organizationId: UUID!
    email: String!
    firstName: String
    lastName: String
    role: UserRole!
    phone: String
    avatar: String
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!

    # Relations
    organization: Organization!
    assignedTasks: [Task!]!
    timeEntries: [TimeEntry!]!
    equipmentAssignments: [EquipmentAssignment!]!
  }

  type Project {
    id: UUID!
    organizationId: UUID!
    name: String!
    description: String
    status: ProjectStatus!
    startDate: DateTime
    endDate: DateTime
    budget: Float
    location: Geometry
    customerName: String
    customerEmail: String
    customerPhone: String
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!

    # Relations
    organization: Organization!
    fiberRoutes: [FiberRoute!]!
    tasks: [Task!]!
    photos: [Photo!]!
    customerAgreements: [CustomerAgreement!]!
    materialAllocations: [MaterialAllocation!]!

    # Computed fields
    progress: Float!
    totalTasks: Int!
    completedTasks: Int!
    estimatedCost: Float
  }

  type FiberRoute {
    id: UUID!
    projectId: UUID!
    name: String!
    fiberType: FiberType!
    length: Float
    geometry: Geometry!
    installationDate: DateTime
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!

    # Relations
    project: Project!
    connections: [FiberConnection!]!

    # Computed fields
    totalConnections: Int!
    activeConnections: Int!
  }

  type FiberConnection {
    id: UUID!
    routeId: UUID!
    name: String!
    status: ConnectionStatus!
    location: Geometry!
    equipmentType: String
    installationDate: DateTime
    testResults: JSON
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!

    # Relations
    route: FiberRoute!
  }

  type Task {
    id: UUID!
    projectId: UUID!
    assignedTo: UUID
    title: String!
    description: String
    status: TaskStatus!
    priority: Int
    dueDate: DateTime
    estimatedHours: Float
    actualHours: Float
    location: Geometry
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!

    # Relations
    project: Project!
    assignee: Profile
    photos: [Photo!]!
    timeEntries: [TimeEntry!]!

    # Computed fields
    isOverdue: Boolean!
    hoursRemaining: Float
  }

  type Photo {
    id: UUID!
    projectId: UUID
    taskId: UUID
    uploadedBy: UUID!
    filename: String!
    url: String!
    thumbnailUrl: String
    location: Geometry
    description: String
    metadata: JSON
    createdAt: DateTime!

    # Relations
    project: Project
    task: Task
    uploader: Profile!
  }

  type Equipment {
    id: UUID!
    organizationId: UUID!
    name: String!
    type: String!
    serialNumber: String
    model: String
    manufacturer: String
    purchaseDate: DateTime
    purchaseCost: Float
    status: EquipmentStatus!
    currentLocation: Geometry
    assignedTo: UUID
    maintenanceSchedule: JSON
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!

    # Relations
    organization: Organization!
    assignee: Profile
    assignments: [EquipmentAssignment!]!
  }

  type EquipmentAssignment {
    id: UUID!
    equipmentId: UUID!
    assignedTo: UUID!
    assignedBy: UUID!
    assignedAt: DateTime!
    returnedAt: DateTime
    notes: String

    # Relations
    equipment: Equipment!
    assignee: Profile!
    assigner: Profile!
  }

  type TimeEntry {
    id: UUID!
    profileId: UUID!
    taskId: UUID
    projectId: UUID
    startTime: DateTime!
    endTime: DateTime
    duration: Float
    description: String
    billableHours: Float
    metadata: JSON
    createdAt: DateTime!

    # Relations
    profile: Profile!
    task: Task
    project: Project
  }

  type CustomerAgreement {
    id: UUID!
    projectId: UUID!
    type: String!
    content: String!
    signedAt: DateTime
    signedBy: String
    documentUrl: String
    metadata: JSON
    createdAt: DateTime!

    # Relations
    project: Project!
  }

  type MaterialAllocation {
    id: UUID!
    projectId: UUID!
    materialId: UUID!
    quantity: Float!
    allocatedAt: DateTime!
    usedQuantity: Float
    returnedQuantity: Float
    notes: String

    # Relations
    project: Project!
    material: Material!
  }

  type Material {
    id: UUID!
    organizationId: UUID!
    name: String!
    type: String!
    unit: String!
    costPerUnit: Float
    currentStock: Float!
    minimumStock: Float
    supplier: String
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!

    # Relations
    organization: Organization!
    allocations: [MaterialAllocation!]!
  }
`;

// Input types for mutations
export const inputTypes = gql`
  input CreateProjectInput {
    name: String!
    description: String
    startDate: DateTime
    budget: Float
    customerName: String
    customerEmail: String
    customerPhone: String
    location: Geometry
    metadata: JSON
  }

  input UpdateProjectInput {
    name: String
    description: String
    status: ProjectStatus
    startDate: DateTime
    endDate: DateTime
    budget: Float
    customerName: String
    customerEmail: String
    customerPhone: String
    location: Geometry
    metadata: JSON
  }

  input CreateTaskInput {
    projectId: UUID!
    assignedTo: UUID
    title: String!
    description: String
    priority: Int
    dueDate: DateTime
    estimatedHours: Float
    location: Geometry
    metadata: JSON
  }

  input UpdateTaskInput {
    assignedTo: UUID
    title: String
    description: String
    status: TaskStatus
    priority: Int
    dueDate: DateTime
    estimatedHours: Float
    actualHours: Float
    location: Geometry
    metadata: JSON
  }

  input CreateFiberRouteInput {
    projectId: UUID!
    name: String!
    fiberType: FiberType!
    length: Float
    geometry: Geometry!
    metadata: JSON
  }

  input UpdateFiberRouteInput {
    name: String
    fiberType: FiberType
    length: Float
    geometry: Geometry
    metadata: JSON
  }
  enum ComparisonOperator {
    EQ
    NEQ
    GT
    GTE
    LT
    LTE
    IN
    LIKE
  }

  enum SortDirection {
    ASC
    DESC
  }

  input FilterInput {
    field: String!
    operator: ComparisonOperator!
    value: String!
  }

  input SortInput {
    field: String!
    direction: SortDirection!
  }

  input PaginationInput {
    page: Int = 1
    limit: Int = 20
  }
`;

// Query and Mutation types
export const rootTypes = gql`
  type Query {
    # Organization queries
    organization(id: UUID!): Organization
    organizations(
      filters: [FilterInput!]
      sort: [SortInput!]
      pagination: PaginationInput
    ): OrganizationConnection!

    # Project queries
    project(id: UUID!): Project
    projects(
      filters: [FilterInput!]
      sort: [SortInput!]
      pagination: PaginationInput
    ): ProjectConnection!
    projectsByStatus(
      status: ProjectStatus!
      pagination: PaginationInput
    ): ProjectConnection!

    # Task queries
    task(id: UUID!): Task
    tasks(
      filters: [FilterInput!]
      sort: [SortInput!]
      pagination: PaginationInput
    ): TaskConnection!
    tasksByProject(
      projectId: UUID!
      pagination: PaginationInput
    ): TaskConnection!
    tasksByAssignee(
      assigneeId: UUID!
      pagination: PaginationInput
    ): TaskConnection!

    # Fiber route queries
    fiberRoute(id: UUID!): FiberRoute
    fiberRoutes(
      filters: [FilterInput!]
      sort: [SortInput!]
      pagination: PaginationInput
    ): FiberRouteConnection!
    fiberRoutesByProject(
      projectId: UUID!
      pagination: PaginationInput
    ): FiberRouteConnection!

    # Equipment queries
    equipment(id: UUID!): Equipment
    equipmentList(
      filters: [FilterInput!]
      sort: [SortInput!]
      pagination: PaginationInput
    ): EquipmentConnection!
    availableEquipment(pagination: PaginationInput): EquipmentConnection!

    # Analytics queries
    projectAnalytics(projectId: UUID!): ProjectAnalytics!
    organizationAnalytics(timeRange: String): OrganizationAnalytics!
    taskAnalytics(filters: [FilterInput!]): TaskAnalytics!
  }

  type Mutation {
    # Project mutations
    createProject(input: CreateProjectInput!): Project!
    updateProject(id: UUID!, input: UpdateProjectInput!): Project!
    deleteProject(id: UUID!): Boolean!

    # Task mutations
    createTask(input: CreateTaskInput!): Task!
    updateTask(id: UUID!, input: UpdateTaskInput!): Task!
    deleteTask(id: UUID!): Boolean!
    assignTask(taskId: UUID!, assigneeId: UUID!): Task!

    # Fiber route mutations
    createFiberRoute(input: CreateFiberRouteInput!): FiberRoute!
    updateFiberRoute(id: UUID!, input: UpdateFiberRouteInput!): FiberRoute!
    deleteFiberRoute(id: UUID!): Boolean!

    # Equipment mutations
    assignEquipment(
      equipmentId: UUID!
      assigneeId: UUID!
      notes: String
    ): EquipmentAssignment!
    returnEquipment(assignmentId: UUID!, notes: String): EquipmentAssignment!

    # Time tracking mutations
    startTimeEntry(
      taskId: UUID
      projectId: UUID
      description: String
    ): TimeEntry!
    stopTimeEntry(id: UUID!): TimeEntry!

    # Photo mutations
    uploadPhoto(
      projectId: UUID
      taskId: UUID
      file: Upload!
      description: String
      location: Geometry
    ): Photo!
    deletePhoto(id: UUID!): Boolean!
  }

  type Subscription {
    # Real-time updates
    projectUpdated(projectId: UUID!): Project!
    taskUpdated(taskId: UUID!): Task!
    taskAssigned(assigneeId: UUID!): Task!
    equipmentStatusChanged(equipmentId: UUID!): Equipment!

    # Organization-wide updates
    organizationActivity(organizationId: UUID!): ActivityEvent!
  }
`;

// Connection types for pagination
export const connectionTypes = gql`
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
    totalCount: Int!
  }

  type OrganizationConnection {
    edges: [OrganizationEdge!]!
    pageInfo: PageInfo!
  }

  type OrganizationEdge {
    node: Organization!
    cursor: String!
  }

  type ProjectConnection {
    edges: [ProjectEdge!]!
    pageInfo: PageInfo!
  }

  type ProjectEdge {
    node: Project!
    cursor: String!
  }

  type TaskConnection {
    edges: [TaskEdge!]!
    pageInfo: PageInfo!
  }

  type TaskEdge {
    node: Task!
    cursor: String!
  }

  type FiberRouteConnection {
    edges: [FiberRouteEdge!]!
    pageInfo: PageInfo!
  }

  type FiberRouteEdge {
    node: FiberRoute!
    cursor: String!
  }

  type EquipmentConnection {
    edges: [EquipmentEdge!]!
    pageInfo: PageInfo!
  }

  type EquipmentEdge {
    node: Equipment!
    cursor: String!
  }
`;

// Analytics types
export const analyticsTypes = gql`
  type ProjectAnalytics {
    projectId: UUID!
    totalTasks: Int!
    completedTasks: Int!
    progress: Float!
    estimatedCost: Float
    actualCost: Float
    timeSpent: Float!
    efficiency: Float!
    statusDistribution: [StatusCount!]!
    timelineData: [TimelinePoint!]!
  }

  type OrganizationAnalytics {
    totalProjects: Int!
    activeProjects: Int!
    completedProjects: Int!
    totalRevenue: Float!
    totalCosts: Float!
    profitMargin: Float!
    equipmentUtilization: Float!
    employeeProductivity: [EmployeeProductivity!]!
    projectStatusDistribution: [StatusCount!]!
  }

  type TaskAnalytics {
    totalTasks: Int!
    completedTasks: Int!
    overdueTasks: Int!
    averageCompletionTime: Float!
    productivityTrends: [ProductivityPoint!]!
  }

  type StatusCount {
    status: String!
    count: Int!
    percentage: Float!
  }

  type TimelinePoint {
    date: DateTime!
    value: Float!
    label: String
  }

  type EmployeeProductivity {
    profileId: UUID!
    name: String!
    tasksCompleted: Int!
    hoursWorked: Float!
    efficiency: Float!
  }

  type ProductivityPoint {
    date: DateTime!
    tasksCompleted: Int!
    hoursWorked: Float!
    efficiency: Float!
  }

  type ActivityEvent {
    id: UUID!
    type: String!
    entityType: String!
    entityId: UUID!
    userId: UUID!
    timestamp: DateTime!
    data: JSON!
  }
`;

// Complete schema
export const typeDefs = gql`
  ${scalarTypes}
  ${enumTypes}
  ${coreTypes}
  ${inputTypes}
  ${rootTypes}
  ${connectionTypes}
  ${analyticsTypes}
`;

// Schema configuration
export const schemaConfig = {
  version: '1.0.0',
  introspection: process.env.NODE_ENV !== 'production',
  playground: process.env.NODE_ENV !== 'production',
  features: {
    subscriptions: true,
    fileUploads: true,
    caching: true,
    rateLimiting: true,
    authentication: true,
    authorization: true,
  },
  limits: {
    maxDepth: 10,
    maxComplexity: 1000,
    maxQueryLength: 10000,
    timeout: 30000, // 30 seconds
  },
};
