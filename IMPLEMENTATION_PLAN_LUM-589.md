# LUM-589: Real-time Conflict Resolution Implementation Plan

## 🎯 Strategic Context

**Task:** LUM-589 - 🔄 Implement real-time conflict resolution  
**Parent Story:** LUM-582 - ⚡ Story 0.75.3: Real-time Data & WebSocket Infrastructure  
**Strategic Position:** Task #6 in Charlie's implementation order  
**Dependency Status:** LUM-588 (Event Sourcing) currently In Progress

## 📋 Current Infrastructure Assessment

### ✅ **Completed Foundation:**

1. **Real-time Protocol** (LUM-586) - Event types defined (FiberSectionStarted, CablePulled, etc.)
2. **WebSocket Gateway** (LUM-591) - Authentication, room-based access, security hardening
3. **Supabase Subscriptions** (LUM-583) - Real-time table change subscriptions
4. **Performance Monitoring** (LUM-587) - Latency tracking, P90/P99 metrics

### 🔄 **In Progress:**

- **Event Sourcing** (LUM-588) - Placeholder integration helpers exist

### ❓ **Dependency Question for @charlie:**

Should we proceed with conflict resolution implementation while LUM-588 is still in progress, or
wait for event sourcing completion?

## 🏗️ **Proposed Implementation Architecture**

### **1. Conflict Detection System**

```typescript
// Location: apps/web/src/lib/realtime/conflict-detector.ts
interface ConflictDetector<StateType> {
  detectConflicts(localState: StateType, remoteEvents: RealtimeEvent[]): Conflict[];
  resolveConflicts(conflicts: Conflict[]): Resolution[];
}
```

### **2. CRDT-Style Merge Algorithms**

```typescript
// Location: apps/web/src/lib/realtime/crdt-merger.ts
interface CRDTMerger {
  mergeGeoCoordinates(local: GeoPoint, remote: GeoPoint, timestamps: Timestamps): GeoPoint;
  mergeProgressPercentages(local: number, remote: number, metadata: ConflictMetadata): number;
  mergeFiberSectionState(local: FiberSection, remote: FiberSection): FiberSection;
}
```

### **3. Optimistic Update Reconciliation**

```typescript
// Location: apps/web/src/lib/realtime/optimistic-reconciler.ts
interface OptimisticReconciler {
  applyOptimisticUpdate(update: LocalUpdate): void;
  reconcileWithAuthoritative(authoritativeState: RemoteState): ReconciliationResult;
  rollbackOptimisticUpdates(conflictedUpdates: LocalUpdate[]): void;
}
```

### **4. Conflict Resolution Strategies**

#### **For Geo-Coordinates (Rural Area Focus):**

- **Last-Writer-Wins with Timestamp Priority**
- **Distance-based validation** (reject coordinates >100m from expected path)
- **Offline-first reconciliation** for poor connectivity areas

#### **For Progress Percentages:**

- **Maximum value wins** (progress can only increase)
- **Validation against section milestones**
- **Rollback protection** (prevent progress decrease without authorization)

#### **For Fiber Section State:**

- **State machine validation** (ensure valid transitions)
- **Role-based conflict resolution** (foreman overrides technician)
- **Audit trail preservation**

## 📁 **File Structure Plan**

```text
apps/web/src/lib/realtime/
├── conflict-resolution/
│   ├── index.ts                    # Main exports
│   ├── conflict-detector.ts        # Conflict detection logic
│   ├── crdt-merger.ts             # CRDT-style merge algorithms
│   ├── optimistic-reconciler.ts   # Optimistic update handling
│   ├── resolution-strategies.ts   # Domain-specific strategies
│   └── types.ts                   # TypeScript interfaces
├── integration/
│   ├── supabase-conflict-bridge.ts # Supabase integration
│   ├── websocket-conflict-bridge.ts # WebSocket integration
│   └── event-sourcing-bridge.ts   # Event sourcing integration
└── __tests__/
    ├── conflict-resolution.test.ts
    ├── crdt-merge.test.ts
    └── optimistic-reconciliation.test.ts
```

## 🔄 **Integration Points**

### **1. Supabase Real-time Integration**

- Hook into existing `SupabaseRealtimeIntegration` class
- Extend real-time subscriptions to detect conflicts
- Integrate with `realtime_events` table

### **2. WebSocket Gateway Integration**

- Extend `WebSocketGatewayIntegration` for conflict broadcasting
- Add conflict resolution message types to the protocol
- Implement room-based conflict notifications

### **3. Event Sourcing Integration** (Pending LUM-588)

- Use the event log for authoritative state reconstruction
- Implement event-based conflict detection
- Provide audit trail for conflict resolutions

## 🧪 **Testing Strategy**

### **Unit Tests:**

- CRDT merge algorithm correctness
- Conflict detection accuracy
- Optimistic update rollback scenarios

### **Integration Tests:**

- Supabase real-time conflict scenarios
- WebSocket conflict broadcasting
- End-to-end conflict resolution flows

### **Load Tests:**

- Concurrent update scenarios
- Rural connectivity simulation
- Performance under conflict load

## 📊 **Success Metrics**

### **Performance Targets:**

- Conflict detection: <50ms
- Conflict resolution: <100ms
- End-to-end reconciliation: <250ms (aligns with existing P90/P99 goals)

### **Quality Targets:**

- Zero data loss during conflicts
- 99.9% successful conflict resolution
- Audit trail completeness

## ⚠️ **Risk Mitigation**

### **Dependency Risk:**

- **Event Sourcing Dependency:** Can implement basic conflict resolution without full event
  sourcing, then enhance when LUM-588 completes
- **Fallback Strategy:** Use timestamp-based resolution as baseline

### **Technical Risks:**

- **Complex CRDT Logic:** Start with simple strategies, iterate based on real-world usage
- **Performance Impact:** Implement with monitoring hooks from existing performance system

## 🚀 **Implementation Phases**

### **Phase 1: Core Infrastructure** (This PR)

1. Basic conflict detection framework
2. Simple CRDT merge algorithms
3. Integration with existing real-time system
4. Unit tests and documentation

### **Phase 2: Advanced Features** (Future PR)

1. Complex conflict resolution strategies
2. Event sourcing integration (after LUM-588)
3. Advanced CRDT algorithms
4. Performance optimizations

## ❓ **Questions for @charlie CharlieHelps**

1. **Dependency Management:** Should we proceed with basic conflict resolution while LUM-588 is in
   progress, or wait for event sourcing completion?

2. **Integration Strategy:** Should we create a new integration branch or work directly on the
   existing real-time infrastructure?

3. **Scope Prioritization:** Which conflict scenarios should we prioritize first - geo-coordinates,
   progress percentages, or state transitions?

4. **Performance vs. Accuracy:** What's the acceptable trade-off between conflict resolution speed
   and accuracy for rural connectivity scenarios?

**⏱️ Waiting for your strategic guidance before proceeding with implementation...**
