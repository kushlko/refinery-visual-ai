export interface FaultRecord {
  timestamp: string;
  component: string;
  tagNumber: string;
  faultType: string;
  description: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  standardGap: string;
  recommendation: string;
}

export interface AnalysisResult {
  summary: string;
  faults: FaultRecord[];
}

export enum AppState {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  READY_TO_ANALYZE = 'READY_TO_ANALYZE',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}
