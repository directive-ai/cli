import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { ConfigService } from '../services/config.service.js';

interface InitOptions {
  author?: string;
  server?: string;
  force?: boolean;
}

/**
 * Commande directive init - Setup global de la CLI
 * Crée ~/.directive/ et configure les préférences par défaut
 */
export const initCommand = new Command('init')
  .description('Initialize Directive CLI configuration (run once per system)')
  .option('--author <author>', 'Default author name for projects')
  .option('--server <url>', 'Default Directive server URL')
  .option('--force', 'Force reinitialize even if config exists')
  .action(async (options: InitOptions) => {
    try {
      console.log(chalk.blue('🚀 Initializing Directive CLI...\n'));

      // 1. Vérifier si config existe déjà
      const configExists = await checkConfigExists();
      if (configExists && !options.force) {
        await displayExistingConfig();
        return;
      }

      if (configExists && options.force) {
        console.log(chalk.yellow('🔄 Force reinitializing CLI configuration...\n'));
      }

      // 2. Collecter les préférences
      const preferences = await collectPreferences(options);
      
      // 3. Créer la configuration
      await initializeConfiguration(preferences);
      
      // 4. Afficher le succès
      displayInitSuccess(preferences);
      
    } catch (error) {
      console.error(chalk.red('❌ Error during initialization:'), 
        error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Vérifie si la configuration CLI existe déjà
 */
async function checkConfigExists(): Promise<boolean> {
  try {
    const configDir = path.join(os.homedir(), '.directive');
    const configFile = path.join(configDir, 'cli-config.json');
    return await fs.pathExists(configFile);
  } catch {
    return false;
  }
}

/**
 * Affiche la configuration existante
 */
async function displayExistingConfig(): Promise<void> {
  console.log(chalk.yellow('⚠️ Directive CLI is already initialized.'));
  
  try {
    const config = await ConfigService.load();
    const configPath = path.join(os.homedir(), '.directive', 'cli-config.json');
    
    console.log(chalk.gray(`Config file: ${configPath}`));
    console.log(chalk.gray(`Server URL: ${config.serverUrl}`));
    console.log(chalk.gray(`Environment: ${config.environment}`));
    
    if (config.user) {
      console.log(chalk.gray(`Logged in as: ${config.user.name} (${config.user.id})`));
    } else {
      console.log(chalk.gray('Not logged in'));
    }
  } catch (error) {
    console.log(chalk.gray('Configuration exists but could not be read'));
  }
  
  console.log(chalk.blue('\n📚 Next steps:'));
  console.log(chalk.gray('   • Login to server: directive login'));
  console.log(chalk.gray('   • Create project: directive create app <name>'));
  console.log(chalk.gray('   • Force reinit: directive init --force'));
}

/**
 * Collecte les préférences utilisateur
 */
async function collectPreferences(options: InitOptions): Promise<{
  author: string;
  serverUrl: string;
}> {
  const questions = [];

  // Auteur par défaut
  if (!options.author) {
    questions.push({
      type: 'input',
      name: 'author',
      message: 'Default author name for new projects:',
      default: 'Directive Developer'
    });
  }

  // URL du serveur par défaut  
  if (!options.server) {
    questions.push({
      type: 'input',
      name: 'serverUrl',
      message: 'Default Directive server URL:',
      default: 'http://localhost:3000',
      validate: (input: string) => {
        try {
          new URL(input);
          return true;
        } catch {
          return 'Please enter a valid URL (e.g., http://localhost:3000)';
        }
      }
    });
  }

  // Prompt seulement si nécessaire
  let answers: any = {};
  if (questions.length > 0) {
    answers = await inquirer.prompt(questions);
  }

  return {
    author: options.author || answers.author || 'Directive Developer',
    serverUrl: options.server || answers.serverUrl || 'http://localhost:3000'
  };
}

/**
 * Initialise la configuration CLI
 */
async function initializeConfiguration(preferences: {
  author: string;
  serverUrl: string;
}): Promise<void> {
  console.log(chalk.yellow('📁 Creating CLI configuration...'));

  // Créer la configuration de base
  const config = {
    serverUrl: preferences.serverUrl,
    environment: 'local' as const,
    preferences: {
      defaultAuthor: preferences.author
    },
    version: '1.0.0',
    lastUpdate: new Date().toISOString()
  };

  // Sauvegarder via ConfigService (qui crée ~/.directive/ automatiquement)
  await ConfigService.save(config);
  
  console.log(chalk.green('✅ CLI configuration created'));
}

/**
 * Affiche le message de succès
 */
function displayInitSuccess(preferences: { author: string; serverUrl: string }): void {
  const configDir = path.join(os.homedir(), '.directive');
  
  console.log(chalk.green('\n🎉 Directive CLI initialized successfully!\n'));
  
  console.log(chalk.blue('📋 Configuration:'));
  console.log(chalk.gray(`   Directory: ${configDir}/`));
  console.log(chalk.gray(`   Config: ${configDir}/cli-config.json`));
  console.log(chalk.gray(`   Author: ${preferences.author}`));
  console.log(chalk.gray(`   Server: ${preferences.serverUrl}`));
  
  console.log(chalk.blue('\n📚 Next steps:'));
  console.log(chalk.gray('   1. Login to your server: directive login'));
  console.log(chalk.gray('   2. Create your first project: directive create app <name>'));
  console.log(chalk.gray('   3. Navigate to project: cd <name>'));
  console.log(chalk.gray('   4. Create your first agent: directive create agent <name>'));
  
  console.log(chalk.blue('\n🌟 Happy coding with Directive!'));
} 