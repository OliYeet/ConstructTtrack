declare module 'graphql-cost-analysis' {
  import { ValidationRule } from 'graphql';

  interface CostAnalysisOptions {
    maximumCost?: number;
    defaultCost?: number;
    scalarCost?: number;
    objectCost?: number;
    listFactor?: number;
    introspectionCost?: number;
    createError?: (max: number, actual: number) => Error;
    onComplete?: (cost: number) => void;
  }

  function costAnalysis(options?: CostAnalysisOptions): ValidationRule;

  export = costAnalysis;
}

declare module 'graphql-depth-limit' {
  import { ValidationRule } from 'graphql';

  function depthLimit(maxDepth: number): ValidationRule;

  export = depthLimit;
}
