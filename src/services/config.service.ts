import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { CLIConfig, UserInfo } from '../types/index.js';

/**
 * Service de gestion de la configuration CLI
 */
export class ConfigService {
  private static readonly CONFIG_DIR = path.join(os.homedir(), '.directive');
  private static readonly CONFIG_FILE = path.join(ConfigService.CONFIG_DIR, 'cli-config.json');
  
  private static readonly DEFAULT_CONFIG: CLIConfig = {
    serverUrl: 'http://localhost:3000',
    environment: 'local'
  };

  /**
   * Initialise le répertoire de configuration
   */
  static async ensureConfigDir(): Promise<void> {
    await fs.ensureDir(this.CONFIG_DIR);
  }

  /**
   * Charge la configuration
   */
  static async load(): Promise<CLIConfig> {
    await this.ensureConfigDir();
    
    try {
      if (await fs.pathExists(this.CONFIG_FILE)) {
        const config = await fs.readJSON(this.CONFIG_FILE);
        return { ...this.DEFAULT_CONFIG, ...config };
      }
    } catch (error) {
      console.warn('Erreur lors du chargement de la configuration:', error);
    }
    
    return { ...this.DEFAULT_CONFIG };
  }

  /**
   * Sauvegarde la configuration
   */
  static async save(config: CLIConfig): Promise<void> {
    await this.ensureConfigDir();
    await fs.writeJSON(this.CONFIG_FILE, config, { spaces: 2 });
  }

  /**
   * Met à jour une partie de la configuration
   */
  static async update(updates: Partial<CLIConfig>): Promise<CLIConfig> {
    const config = await this.load();
    const newConfig = { ...config, ...updates };
    await this.save(newConfig);
    return newConfig;
  }

  /**
   * Définit l'URL du serveur
   */
  static async setServerUrl(url: string): Promise<void> {
    await this.update({ serverUrl: url });
  }

  /**
   * Définit le token d'authentification
   */
  static async setAuthToken(token: string, user: UserInfo): Promise<void> {
    await this.update({ authToken: token, user });
  }

  /**
   * Supprime le token d'authentification
   */
  static async clearAuth(): Promise<void> {
    await this.update({ authToken: undefined, user: undefined });
  }

  /**
   * Vérifie si l'utilisateur est connecté
   */
  static async isLoggedIn(): Promise<boolean> {
    const config = await this.load();
    return !!config.authToken && !!config.user;
  }

  /**
   * Récupère l'utilisateur connecté
   */
  static async getCurrentUser(): Promise<UserInfo | null> {
    const config = await this.load();
    return config.user || null;
  }

  /**
   * Récupère le token d'authentification
   */
  static async getAuthToken(): Promise<string | null> {
    const config = await this.load();
    return config.authToken || null;
  }

  /**
   * Récupère l'URL du serveur
   */
  static async getServerUrl(): Promise<string> {
    const config = await this.load();
    return config.serverUrl;
  }

  /**
   * Définit l'environnement
   */
  static async setEnvironment(environment: 'local' | 'production'): Promise<void> {
    await this.update({ environment });
  }

  /**
   * Supprime toute la configuration
   */
  static async reset(): Promise<void> {
    await this.ensureConfigDir();
    if (await fs.pathExists(this.CONFIG_FILE)) {
      await fs.remove(this.CONFIG_FILE);
    }
  }
} 