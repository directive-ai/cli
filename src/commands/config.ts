import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigService } from '../services/config.service.js';
import { ApiService } from '../services/api.service.js';

export const configCommand = new Command('config')
  .description('Gérer la configuration de la CLI');

// Sous-commande pour lister la configuration
configCommand
  .command('list')
  .alias('show')
  .description('Afficher la configuration actuelle')
  .action(async () => {
    try {
      const config = await ConfigService.load();
      const isLoggedIn = await ConfigService.isLoggedIn();
      
      console.log(chalk.blue('📋 Configuration Directive CLI'));
      console.log('');
      
      console.log(chalk.yellow('Serveur:'));
      console.log(`  URL: ${config.serverUrl}`);
      console.log(`  Environnement: ${config.environment || 'local'}`);
      
      console.log('');
      console.log(chalk.yellow('Authentification:'));
      if (isLoggedIn && config.user) {
        console.log(`  Statut: ${chalk.green('✅ Connecté')}`);
        console.log(`  Utilisateur: ${config.user.name} (${config.user.id})`);
        console.log(`  Rôles: ${config.user.roles?.join(', ') || 'Aucun'}`);
      } else {
        console.log(`  Statut: ${chalk.red('❌ Non connecté')}`);
      }

      // Vérifier la connectivité au serveur
      console.log('');
      console.log(chalk.yellow('Connectivité:'));
      try {
        const apiService = new ApiService();
        const isHealthy = await apiService.healthCheck();
        
        if (isHealthy) {
          console.log(`  Serveur: ${chalk.green('✅ Accessible')}`);
          
          // Récupérer les informations du serveur
          const serverInfo = await apiService.getServerInfo();
          console.log(`  Version: ${serverInfo.version}`);
          console.log(`  Status: ${serverInfo.status}`);
        } else {
          console.log(`  Serveur: ${chalk.red('❌ Inaccessible')}`);
        }
      } catch (error) {
        console.log(`  Serveur: ${chalk.red('❌ Erreur de connexion')}`);
      }

    } catch (error: any) {
      console.error(chalk.red('❌ Erreur:'), error.message);
      process.exit(1);
    }
  });

// Sous-commande pour configurer l'URL du serveur
configCommand
  .command('set-server')
  .description('Configurer l\'URL du serveur Directive')
  .argument('<url>', 'URL du serveur (ex: http://localhost:3000 ou https://api.directive.com)')
  .action(async (url: string) => {
    try {
      // Valider l'URL
      try {
        new URL(url);
      } catch {
        console.error(chalk.red('❌ URL invalide:'), url);
        process.exit(1);
      }

      await ConfigService.setServerUrl(url);
      console.log(chalk.green('✅ URL du serveur configurée:'), url);
      
      // Tester la connectivité
      console.log(chalk.blue('🔄 Test de connectivité...'));
      const apiService = new ApiService();
      const isHealthy = await apiService.healthCheck();
      
      if (isHealthy) {
        console.log(chalk.green('✅ Serveur accessible'));
        
        // Afficher les informations du serveur
        try {
          const serverInfo = await apiService.getServerInfo();
          console.log(chalk.gray(`Version: ${serverInfo.version}`));
          console.log(chalk.gray(`Environnement: ${serverInfo.environment}`));
        } catch (error) {
          console.log(chalk.gray('Informations serveur non disponibles'));
        }
      } else {
        console.log(chalk.yellow('⚠️ Serveur non accessible actuellement'));
        console.log(chalk.gray('La configuration a été sauvegardée, vous pourrez vous connecter plus tard.'));
      }

    } catch (error: any) {
      console.error(chalk.red('❌ Erreur:'), error.message);
      process.exit(1);
    }
  });

// Sous-commande pour définir l'environnement
configCommand
  .command('set-environment')
  .alias('set-env')
  .description('Configurer l\'environnement (local ou production)')
  .argument('<environment>', 'Environnement: local ou production')
  .action(async (environment: string) => {
    try {
      if (!['local', 'production'].includes(environment)) {
        console.error(chalk.red('❌ Environnement invalide:'), environment);
        console.log(chalk.yellow('Valeurs acceptées: local, production'));
        process.exit(1);
      }

      await ConfigService.setEnvironment(environment as 'local' | 'production');
      console.log(chalk.green('✅ Environnement configuré:'), environment);

    } catch (error: any) {
      console.error(chalk.red('❌ Erreur:'), error.message);
      process.exit(1);
    }
  });

// Sous-commande pour réinitialiser la configuration
configCommand
  .command('reset')
  .description('Réinitialiser toute la configuration')
  .option('--force', 'Force la réinitialisation sans confirmation')
  .action(async (options) => {
    try {
      if (!options.force) {
        console.log(chalk.yellow('⚠️ Cette action va supprimer toute la configuration, y compris les tokens d\'authentification.'));
        console.log(chalk.gray('Utilisez --force pour confirmer.'));
        process.exit(1);
      }

      await ConfigService.reset();
      console.log(chalk.green('✅ Configuration réinitialisée'));
      console.log(chalk.gray('Vous devrez vous reconnecter avec: directive login'));

    } catch (error: any) {
      console.error(chalk.red('❌ Erreur:'), error.message);
      process.exit(1);
    }
  }); 