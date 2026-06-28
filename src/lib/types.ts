export interface Tenant {
  PK: string; // TENANT#<TenantID>
  SK: string; // METADATA
  TenantName: string;
  TenantSlug: string;
  CreatedAt: string;
  Status: 'ACTIVE' | 'SUSPENDED';
  Plan: 'FREE_TIER' | 'ENTERPRISE';
  EvaluationMode?: 'HYBRID_HEURISTIC' | 'PURE_OLLAMA';
  OllamaEndpoint?: string;
  OllamaModel?: string;
  SensitiveFilePatterns?: string[];
}

export interface Employee {
  PK: string; // TENANT#<TenantID>
  SK: string; // EMP#<EmployeeID>
  EmployeeId: string;
  EmployeeName: string;
  Email: string;
  Department: string;
  Role: string;
  GSI1PK: string; // DEPT#<Department>
  GSI1SK: string; // EMP#<EmployeeID>
}

export interface HardwareAsset {
  PK: string; // TENANT#<TenantID>
  SK: string; // ASSET#<AssetID>
  AssetId: string;
  AssetName: string;
  SerialNo: string;
  Type: 'LAPTOP' | 'MOBILE' | 'MONITOR' | 'PERIPHERAL' | 'SERVER';
  Status: 'PROCURING' | 'IN_TRANSIT' | 'ACTIVE' | 'MAINTENANCE' | 'OFFBOARDING' | 'RETIRED' | 'ISOLATED';
  EmployeeId: string; // Linked employee or 'UNASSIGNED'
  EmployeeName: string; // Cached for easy listing
  GSI1PK: string; // EMP#<EmployeeId>
  GSI1SK: string; // STATE#<Status>
  GSI2PK?: string; // TENANT#<TenantID>#ACTION_REQ (if applicable)
  GSI2SK?: string; // DATE#<Timestamp>
  LastHeartbeat?: string;
  AgentKey?: string; // Unique telemetry ingest key
  HardwareUuid?: string; // Hardware-locked motherboard UUID / BIOS serial
  UpdatedAt: string;
}

export interface ProcurementRequest {
  PK: string; // TENANT#<TenantID>
  SK: string; // PROCURE#<RequestID>
  RequestId: string;
  RequesterId: string;
  RequesterName: string;
  AssetName: string;
  Type: 'LAPTOP' | 'MOBILE' | 'MONITOR' | 'PERIPHERAL';
  Department: string;
  Status: 'PENDING' | 'APPROVED' | 'REJECTED';
  CreatedAt: string;
  GSI1PK: string; // DEPT#<Department>
  GSI1SK: string; // DATE#<Timestamp>
  GSI2PK?: string; // TENANT#<TenantID>#PENDING_PROCURE (only if PENDING)
  GSI2SK?: string; // DEPT#<Department>#DATE#<Timestamp>
}

export interface AuditLog {
  PK: string; // TENANT#<TenantID>
  SK: string; // AUDIT#<AssetID>#<Timestamp>
  AssetId: string;
  ActorId: string;
  ActorName: string;
  Action: string;
  Timestamp: string;
  Details: string;
}

export interface AgentTelemetry {
  PK: string; // TENANT#<TenantID>
  SK: string; // TELEMETRY#<AssetID>#<Timestamp>
  AssetId: string;
  Timestamp: string;
  ProcessName: string; // e.g. "llama.cpp", "ollama", "copilot"
  FilesAccessed: string[]; // e.g. ["payroll.xlsx"]
  CpuUsage: number;
  RamUsage: number;
  NetworkEgress: number; // MB
  RiskLevel: 'PENDING' | 'SAFE' | 'WARNING' | 'CRITICAL';
  AiAnalysis?: string; // Summary from Groq/Gemini
  GSI1PK: string; // ASSET#<AssetID>
  GSI1SK: string; // DATE#<Timestamp>
}

export interface SecurityAlert {
  PK: string; // TENANT#<TenantID>
  SK: string; // ALERT#<Timestamp>
  AlertId: string;
  AssetId: string;
  Severity: 'HIGH' | 'CRITICAL';
  Message: string;
  Timestamp: string;
  Status: 'OPEN' | 'RESOLVED';
  GSI1PK?: string; // TENANT#<TenantID>#OPEN_ALERTS (only if OPEN)
  GSI1SK?: string; // DATE#<Timestamp>
}
