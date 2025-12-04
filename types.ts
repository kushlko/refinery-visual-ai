export interface InspectionRecord {
  serial_no: number;
  timestamp: string;
  tag_number: string;
  equipment_type: string;
  fault_type: string;
  severity: 'Low' | 'Medium' | 'High';
  corrective_action: string;
  remarks: string;
}

export interface AnalysisResult {
  inspection_report: InspectionRecord[];
}

export enum AppState {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  READY_TO_ANALYZE = 'READY_TO_ANALYZE',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}
