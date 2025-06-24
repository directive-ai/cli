import { Command } from 'commander';
import chalk from 'chalk';
import { ApiService } from '../services/api.service.js';
import { ConfigService } from '../services/config.service.js';

export const logoutCommand = new Command('logout')
  .description('Se déconnecter du serveur Directive')
  .action(async () => {
    try {
      const isLoggedIn = await ConfigService.isLoggedIn();
      
      if (!isLoggedIn) {
        console.log(chalk.yellow('⚠️ Vous n\'êtes pas connecté.'));
        return;
      }

      const user = await ConfigService.getCurrentUser();
      console.log(chalk.blue(`🔓 Déconnexion de ${user?.name || 'utilisateur inconnu'}...`));

      // Notifier le serveur de la déconnexion
      try {
        const apiService = new ApiService();
        await apiService.logout();
      } catch (error) {
        // Ignorer les erreurs de logout côté serveur
        console.log(chalk.gray('Note: Erreur lors de la notification de déconnexion au serveur'));
      }

      // Supprimer les informations d'authentification locales
      await ConfigService.clearAuth();
      
      console.log(chalk.green('✅ Déconnexion réussie !'));
      console.log(chalk.gray('Token d\'authentification supprimé de la configuration locale.'));

    } catch (error: any) {
      console.error(chalk.red('❌ Erreur lors de la déconnexion:'), error.message);
      process.exit(1);
    }
  }); 