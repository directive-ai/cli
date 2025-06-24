import axios, { AxiosInstance, AxiosResponse } from 'axios';
import chalk from 'chalk';
import { ConfigService } from './config.service.js';
import { 
  ApiResponse, 
  LoginRequest, 
  LoginResponse, 
  Application, 
  Agent, 
  CreateApplicationRequest,
  CreateAgentRequest,
  DeployAgentRequest,
  ServerInfo
} from '../types/index.js';

/**
 * Service API pour communiquer avec le serveur Directive Core
 */
export class ApiService {
  private client: AxiosInstance;

  constructor(serverUrl?: string) {
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'directive-cli/1.0.0'
      }
    });

    // Intercepteur pour ajouter automatiquement le token d'auth
    this.client.interceptors.request.use(async (config) => {
      if (!config.baseURL) {
        config.baseURL = serverUrl || await ConfigService.getServerUrl();
      }
      
      const token = await ConfigService.getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      return config;
    });

    // Intercepteur pour gérer les erreurs d'authentification
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          await ConfigService.clearAuth();
          console.error(chalk.red('❌ Session expirée. Veuillez vous reconnecter avec: directive login'));
          process.exit(1);
        }
        return Promise.reject(error);
      }
    );
  }

  // ==========================================
  // Authentification
  // ==========================================

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response: AxiosResponse<ApiResponse<LoginResponse>> = await this.client.post('/api/auth/login', credentials);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Erreur de connexion');
    }
    
    return response.data.data!;
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/api/auth/logout');
    } catch (error) {
      // Ignore les erreurs de logout côté serveur
    }
  }

  async whoami(): Promise<any> {
    const response: AxiosResponse<ApiResponse> = await this.client.get('/api/auth/me');
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Erreur lors de la récupération du profil');
    }
    
    return response.data.data;
  }

  // ==========================================
  // Applications
  // ==========================================

  async getApplications(): Promise<Application[]> {
    const response: AxiosResponse<ApiResponse<Application[]>> = await this.client.get('/api/applications');
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Erreur lors de la récupération des applications');
    }
    
    return response.data.data || [];
  }

  async createApplication(data: CreateApplicationRequest): Promise<Application> {
    const response: AxiosResponse<ApiResponse<Application>> = await this.client.post('/api/applications', data);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Erreur lors de la création de l\'application');
    }
    
    return response.data.data!;
  }

  async deleteApplication(nameOrId: string): Promise<void> {
    const response: AxiosResponse<ApiResponse> = await this.client.delete(`/api/applications/${nameOrId}`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error deleting application');
    }
  }

  // ==========================================
  // Agents
  // ==========================================

  async getAgents(applicationId?: string): Promise<Agent[]> {
    const url = applicationId ? `/api/agents?applicationId=${applicationId}` : '/api/agents';
    const response: AxiosResponse<ApiResponse<Agent[]>> = await this.client.get(url);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Erreur lors de la récupération des agents');
    }
    
    return response.data.data || [];
  }

  async createAgent(data: CreateAgentRequest): Promise<Agent> {
    const response: AxiosResponse<ApiResponse<Agent>> = await this.client.post('/api/agents', data);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Erreur lors de la création de l\'agent');
    }
    
    return response.data.data!;
  }

  async deployAgent(data: DeployAgentRequest): Promise<void> {
    const response: AxiosResponse<ApiResponse> = await this.client.post(`/api/agents/${data.agentId}/deploy`, {
      force: data.force
    });
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Erreur lors du déploiement de l\'agent');
    }
  }

  async getAgentStatus(agentId: string): Promise<Agent> {
    const response: AxiosResponse<ApiResponse<Agent>> = await this.client.get(`/api/agents/${agentId}/status`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Erreur lors de la récupération du statut de l\'agent');
    }
    
    return response.data.data!;
  }

  async deleteAgent(nameOrId: string): Promise<void> {
    const response: AxiosResponse<ApiResponse> = await this.client.delete(`/api/agents/${nameOrId}`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error deleting agent');
    }
  }

  async getAgentVersions(agentId: string): Promise<any[]> {
    const response: AxiosResponse<ApiResponse<any[]>> = await this.client.get(`/api/deployments/agent/${agentId}/versions`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error retrieving agent versions');
    }
    
    return response.data.data || [];
  }

  async deleteAgentVersion(agentId: string, version: string): Promise<void> {
    const response: AxiosResponse<ApiResponse> = await this.client.delete(`/api/deployments/agent/${agentId}/version/${version}`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error deleting agent version');
    }
  }

  async deleteAllAgentVersions(agentId: string): Promise<void> {
    const response: AxiosResponse<ApiResponse> = await this.client.delete(`/api/deployments/agent/${agentId}/versions`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error deleting all agent versions');
    }
  }

  // ==========================================
  // Utilitaires
  // ==========================================

  async getServerInfo(): Promise<ServerInfo> {
    const response: AxiosResponse<ApiResponse<ServerInfo>> = await this.client.get('/api/info');
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Erreur lors de la récupération des informations du serveur');
    }
    
    return response.data.data!;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/api/health');
      return true;
    } catch (error) {
      return false;
    }
  }
} 