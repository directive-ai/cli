#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigService } from './services/config.service.js';

// Import des commandes
import { initCommand } from './commands/init.js';
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';
import { configCommand } from './commands/config.js';
import { createAppCommand } from './commands/create-app.js';
import { createAgentCommand } from './commands/create-agent.js';
import { deployCommand } from './commands/deploy.js';

const program = new Command();

program
  .name('directive')
  .description('CLI pour Directive - AI Agents Orchestrator')
  .version('1.0.0');

// Gestionnaire global d'erreurs
program.exitOverride((err) => {
  if (err.code === 'commander.version') {
    process.exit(0);
  }
  console.error(chalk.red('Erreur:'), err.message);
  process.exit(1);
});

// Middleware pour vérifier l'authentification sur certaines commandes  
// TODO: Corriger les erreurs TypeScript avec _actionHandler
const requireAuth = (command: Command) => {
  // Temporairement désactivé pour éviter les erreurs TypeScript
  return command;
};

// Ajouter les commandes (init n'a pas besoin d'auth)
program.addCommand(initCommand);
program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(configCommand);

// Commande whoami
program
  .command('whoami')
  .description('Afficher l\'utilisateur connecté')
  .action(async () => {
    try {
      const isLoggedIn = await ConfigService.isLoggedIn();
      
      if (!isLoggedIn) {
        console.log(chalk.yellow('❌ Non connecté'));
        console.log(chalk.gray('Utilisez: directive login'));
        return;
      }

      const user = await ConfigService.getCurrentUser();
      const config = await ConfigService.load();
      
      console.log(chalk.blue('👤 Utilisateur connecté'));
      console.log(`Nom: ${user?.name || 'Inconnu'}`);
      console.log(`ID: ${user?.id || 'Inconnu'}`);
      console.log(`Rôles: ${user?.roles?.join(', ') || 'Aucun'}`);
      console.log(`Serveur: ${config.serverUrl}`);

    } catch (error: any) {
      console.error(chalk.red('❌ Erreur:'), error.message);
      process.exit(1);
    }
  });

// Commande create avec sous-commandes
const createCommand = new Command('create')
  .description('Créer une nouvelle ressource (app ou agent)');

// Ajouter les vraies commandes create
createCommand.addCommand(createAppCommand);
createCommand.addCommand(createAgentCommand);

program.addCommand(requireAuth(createCommand));

// Commande list
const listCommand = new Command('list')
  .description('Lister les ressources');

listCommand
  .command('apps')
  .description('Lister les applications')
  .action(async () => {
    console.log(chalk.blue('📋 Liste des applications'));
    console.log(chalk.yellow('⚠️ Implémentation en cours - cette commande utilisera l\'API REST'));
  });

listCommand
  .command('agents')
  .description('Lister les agents')
  .option('-a, --app <app>', 'Filtrer par application')
  .action(async (options) => {
    console.log(chalk.blue('📋 Liste des agents'));
    if (options.app) {
      console.log(`Application: ${options.app}`);
    }
    console.log(chalk.yellow('⚠️ Implémentation en cours - cette commande utilisera l\'API REST'));
  });

program.addCommand(requireAuth(listCommand));

// Commande delete
const deleteCommand = new Command('delete')
  .description('Supprimer une ressource');

deleteCommand
  .command('app')
  .description('Supprimer une application')
  .argument('<n>', 'Nom de l\'application')
  .option('--force', 'Forcer la suppression sans confirmation')
  .action(async (name: string, options) => {
    console.log(chalk.red('🗑️ Suppression d\'application...'));
    console.log(`Nom: ${name}`);
    console.log(chalk.yellow('⚠️ Implémentation en cours - cette commande utilisera l\'API REST'));
  });

deleteCommand
  .command('agent')
  .description('Supprimer un agent')
  .argument('<n>', 'Nom de l\'agent')
  .option('--force', 'Forcer la suppression sans confirmation')
  .action(async (name: string, options) => {
    console.log(chalk.red('🗑️ Suppression d\'agent...'));
    console.log(`Nom: ${name}`);
    console.log(chalk.yellow('⚠️ Implémentation en cours - cette commande utilisera l\'API REST'));
  });

program.addCommand(requireAuth(deleteCommand));

// Commande deploy
program.addCommand(requireAuth(deployCommand));

// Commande status
program
  .command('status')
  .description('Afficher le statut d\'une ressource')
  .argument('<type>', 'Type de ressource (agent)')
  .argument('<n>', 'Nom de la ressource')
  .action(async (type: string, name: string) => {
    // TODO: Ajouter vérification auth ici
    console.log(chalk.blue('📊 Statut...'));
    console.log(`Type: ${type}`);
    console.log(`Nom: ${name}`);
    console.log(chalk.yellow('⚠️ Implémentation en cours - cette commande utilisera l\'API REST'));
  });

// Commande de test temporaire
program
  .command('test')
  .description('Commande de test - CLI séparée')
  .action(() => {
    console.log(chalk.green('✅ CLI Directive (version séparée) fonctionne !'));
    console.log(chalk.blue('Version:'), '1.0.0');
    console.log(chalk.blue('Mode:'), 'CLI autonome avec API REST');
    console.log(chalk.yellow('🔗 Authentification:'), 'Requise pour la plupart des commandes');
  });

// Parser les arguments
program.parseAsync(process.argv).catch((error) => {
  console.error(chalk.red('Erreur:'), error.message);
  process.exit(1);
});

// Si aucune commande fournie, afficher l'aide
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

export { program }; 