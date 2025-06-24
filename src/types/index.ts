/**
 * Types pour la CLI Directive
 */

export interface CLIConfig {
  serverUrl: string;
  authToken?: string;
  user?: UserInfo;
  environment?: 'local' | 'production';
  preferences?: {
    defaultAuthor?: string;
  };
  version?: string;
  lastUpdate?: string;
}

export interface UserInfo {
  id: string;
  name: string;
  roles: string[];
  permissions: string[];
}

export interface LoginRequest {
  email?: string;
  password?: string;
  token?: string;
  provider?: 'email' | 'token' | 'github' | 'google';
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: UserInfo;
  expiresIn: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Application {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: string;
  agents: Agent[];
}

export interface Agent {
  id: string;
  name: string;
  type: string;
  applicationId: string;
  status: 'created' | 'deployed' | 'running' | 'stopped' | 'error';
  createdBy: string;
  createdAt: string;
  lastDeployedAt?: string;
}

export interface CreateApplicationRequest {
  name: string;
  description: string;
}

export interface CreateAgentRequest {
  name: string;
  type: string;
  applicationId: string;
  description?: string;
}

export interface DeployAgentRequest {
  agentId: string;
  force?: boolean;
}

// DTOs pour le déploiement
export interface UploadBundleRequest {
  agentId: string;
  version: string;
  force?: boolean;
  metadata: {
    buildHash: string;
    buildTime: string;
    dependencies: Record<string, string>;
    gitCommit?: string;
  };
}

export interface UploadBundleResponse {
  success: boolean;
  deploymentId: string;
  version: string;
  url?: string;
  rollbackVersion?: string;
  bundleSize: number;
  message: string;
}

export interface AgentVersion {
  id: string;
  agentId: string;
  version: string;
  bundleSize: number;
  deployedAt: string;
  status: 'active' | 'inactive' | 'rollback';
  metadata: {
    buildHash: string;
    buildTime: string;
    dependencies: Record<string, string>;
    gitCommit?: string;
  };
  url?: string;
}

export interface ServerInfo {
  version: string;
  status: 'healthy' | 'unhealthy';
  environment: 'local' | 'production';
  features: string[];
} 