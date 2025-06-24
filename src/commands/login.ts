import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { ApiService } from '../services/api.service.js';
import { ConfigService } from '../services/config.service.js';
import { LoginRequest } from '../types/index.js';

export const loginCommand = new Command('login')
  .description('Se connecter au serveur Directive')
  .option('-s, --server <url>', 'URL du serveur Directive')
  .option('-t, --token <token>', 'Token d\'authentification')
  .option('-e, --email <email>', 'Adresse email')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔐 Connexion au serveur Directive'));

      // Configurer l'URL du serveur si fournie
      if (options.server) {
        await ConfigService.setServerUrl(options.server);
        console.log(chalk.green(`✅ URL du serveur configurée: ${options.server}`));
      }

      const serverUrl = await ConfigService.getServerUrl();
      console.log(chalk.gray(`Serveur: ${serverUrl}`));

      // Vérifier si le serveur est accessible
      const apiService = new ApiService();
      const isHealthy = await apiService.healthCheck();
      
      if (!isHealthy) {
        console.error(chalk.red(`❌ Le serveur Directive n'est pas accessible à l'adresse: ${serverUrl}`));
        console.log(chalk.yellow('💡 Assurez-vous que le serveur est démarré et accessible.'));
        console.log(chalk.yellow('💡 Utilisez --server <url> pour configurer une autre URL.'));
        process.exit(1);
      }

      console.log(chalk.green('✅ Serveur accessible'));

      // Préparer les données de connexion
      const credentials: LoginRequest = {};

      if (options.token) {
        credentials.token = options.token;
        credentials.provider = 'token';
      } else if (options.email) {
        credentials.email = options.email;
        credentials.provider = 'email';
        
        // Demander le mot de passe
        const { password } = await inquirer.prompt([
          {
            type: 'password',
            name: 'password',
            message: 'Mot de passe:',
            mask: '*'
          }
        ]);
        credentials.password = password;
      } else {
        // Mode interactif
        const { authMethod } = await inquirer.prompt([
          {
            type: 'list',
            name: 'authMethod',
            message: 'Méthode d\'authentification:',
            choices: [
              { name: 'Token d\'authentification', value: 'token' },
              { name: 'Email et mot de passe', value: 'email' }
            ]
          }
        ]);

        if (authMethod === 'token') {
          const { token } = await inquirer.prompt([
            {
              type: 'password',
              name: 'token',
              message: 'Token d\'authentification:',
              mask: '*'
            }
          ]);
          credentials.token = token;
          credentials.provider = 'token';
        } else {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'email',
              message: 'Adresse email:',
              validate: (input) => input.includes('@') || 'Veuillez entrer une adresse email valide'
            },
            {
              type: 'password',
              name: 'password',
              message: 'Mot de passe:',
              mask: '*'
            }
          ]);
          credentials.email = answers.email;
          credentials.password = answers.password;
          credentials.provider = 'email';
        }
      }

      // Effectuer la connexion
      console.log(chalk.blue('🔄 Authentification en cours...'));
      
      try {
        const response = await apiService.login(credentials);
        
        // Sauvegarder les informations d'authentification
        await ConfigService.setAuthToken(response.token, response.user);
        
        console.log(chalk.green('✅ Connexion réussie !'));
        console.log(chalk.blue(`👤 Connecté en tant que: ${response.user.name} (${response.user.id})`));
        console.log(chalk.gray(`🔑 Token valide pendant ${Math.round(response.expiresIn / 3600)} heures`));
        
        if (response.user.roles && response.user.roles.length > 0) {
          console.log(chalk.gray(`👥 Rôles: ${response.user.roles.join(', ')}`));
        }

      } catch (error: any) {
        console.error(chalk.red('❌ Erreur d\'authentification:'), error.message);
        console.log(chalk.yellow('💡 Vérifiez vos identifiants et réessayez.'));
        process.exit(1);
      }

    } catch (error: any) {
      console.error(chalk.red('❌ Erreur:'), error.message);
      process.exit(1);
    }
  }); 