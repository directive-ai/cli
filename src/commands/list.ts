import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigService } from '../services/config.service.js';
import { ApiService } from '../services/api.service.js';

interface ListOptions {
  app?: string;
  status?: string;
}

/**
 * Commande directive list - Afficher les ressources de l'utilisateur
 */
export const listCommand = new Command('list')
  .description('Lister les ressources (applications et agents)');

// Sous-commande: list apps
const listAppsCommand = new Command('apps')
  .description('Lister les applications')
  .action(async () => {
    try {
      console.log(chalk.blue('📋 Liste des applications\n'));

      // 1. Vérifier l'authentification
      await ensureAuthenticated();

      // 2. Récupérer les applications via API
      const apiService = new ApiService();
      const applications = await apiService.getApplications();

      // 3. Afficher les résultats
      if (applications.length === 0) {
        console.log(chalk.yellow('⚠️  Aucune application trouvée'));
        console.log(chalk.gray('💡 Créez votre première application avec: directive create app'));
        return;
      }

      console.log(chalk.green(`✅ ${applications.length} application(s) trouvée(s):\n`));

      applications.forEach((app: any, index) => {
        console.log(chalk.white(`${index + 1}. ${chalk.bold(app.name)} (${app.id})`));
        console.log(chalk.gray(`   Description: ${app.description || 'Aucune description'}`));
        console.log(chalk.gray(`   Auteur: ${app.author || app.createdBy || 'Inconnu'}`));
        console.log(chalk.gray(`   Version: ${app.version || '1.0.0'}`));
        console.log(chalk.gray(`   Agents: ${app.agents_count || app.agents?.length || 0}`));
        console.log(chalk.gray(`   Créée: ${new Date(app.created_at || app.createdAt).toLocaleDateString('fr-FR')}`));
        console.log('');
      });

    } catch (error) {
      console.error(chalk.red('❌ Erreur lors de la récupération des applications:'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// Sous-commande: list agents
const listAgentsCommand = new Command('agents')
  .description('Lister les agents')
  .option('-a, --app <app>', 'Filtrer par application (nom ou ID)')
  .option('-s, --status <status>', 'Filtrer par statut (created, deployed, running, stopped, error)')
  .action(async (options: ListOptions) => {
    try {
      console.log(chalk.blue('📋 Liste des agents\n'));

      // 1. Vérifier l'authentification
      await ensureAuthenticated();

      // 2. Récupérer les agents via API
      const apiService = new ApiService();
      let agents = await apiService.getAgents(options.app);

      // 3. Appliquer les filtres
      if (options.app) {
        const appFilter = options.app;
        agents = agents.filter(agent => 
          agent.applicationId === appFilter || 
          agent.type.includes(appFilter)
        );
        console.log(chalk.gray(`🔍 Filtré par application: ${appFilter}`));
      }

      if (options.status) {
        agents = agents.filter(agent => agent.status === options.status);
        console.log(chalk.gray(`🔍 Filtré par statut: ${options.status}\n`));
      }

      // 4. Afficher les résultats
      if (agents.length === 0) {
        console.log(chalk.yellow('⚠️  Aucun agent trouvé'));
        console.log(chalk.gray('💡 Créez votre premier agent avec: directive create agent'));
        return;
      }

      console.log(chalk.green(`✅ ${agents.length} agent(s) trouvé(s):\n`));

      // Regrouper par application pour un affichage plus clair
      const agentsByApp = agents.reduce((acc, agent) => {
        const appName = agent.type.split('/')[0] || 'Unknown';
        if (!acc[appName]) {
          acc[appName] = [];
        }
        acc[appName].push(agent);
        return acc;
      }, {} as Record<string, any[]>);

      Object.entries(agentsByApp).forEach(([appName, appAgents]) => {
        console.log(chalk.cyan(`📱 Application: ${appName}`));
        
        appAgents.forEach((agent, index) => {
          const statusIcon = getStatusIcon(agent.status);
          const agentName = agent.type.split('/')[1] || agent.name;
          
          console.log(`   ${index + 1}. ${statusIcon} ${chalk.bold(agentName)} (${agent.id})`);
          console.log(chalk.gray(`      Description: ${agent.description || 'Aucune description'}`));
          console.log(chalk.gray(`      Statut: ${agent.status}`));
          console.log(chalk.gray(`      Auteur: ${agent.author}`));
          console.log(chalk.gray(`      Créé: ${new Date(agent.created_at).toLocaleDateString('fr-FR')}`));
          
          if (agent.lastDeployedAt) {
            console.log(chalk.gray(`      Déployé: ${new Date(agent.lastDeployedAt).toLocaleDateString('fr-FR')}`));
          }
          console.log('');
        });
      });

    } catch (error) {
      console.error(chalk.red('❌ Erreur lors de la récupération des agents:'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// Ajouter les sous-commandes
listCommand.addCommand(listAppsCommand);
listCommand.addCommand(listAgentsCommand);

/**
 * Vérifier l'authentification
 */
async function ensureAuthenticated(): Promise<void> {
  const isLoggedIn = await ConfigService.isLoggedIn();
  if (!isLoggedIn) {
    throw new Error('Authentification requise. Utilisez: directive login');
  }
}

/**
 * Retourner l'icône correspondant au statut
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case 'created': return '📝';
    case 'deployed': return '🚀';
    case 'running': return '✅';
    case 'stopped': return '⏹️';
    case 'error': return '❌';
    default: return '❓';
  }
} 