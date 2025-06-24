import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigService } from '../services/config.service.js';
import { ApiService } from '../services/api.service.js';

/**
 * Commande directive status - Afficher le statut détaillé d'un agent
 */
export const statusCommand = new Command('status')
  .description('Afficher le statut détaillé d\'un agent')
  .argument('<type>', 'Type de ressource (agent)')
  .argument('<name>', 'Nom de l\'agent')
  .action(async (type: string, agentName: string) => {
    try {
      if (type !== 'agent') {
        throw new Error('Seul le type "agent" est supporté. Usage: directive status agent <name>');
      }

      console.log(chalk.blue(`📊 Statut de l'agent ${chalk.white(agentName)}\n`));

      // 1. Vérifier l'authentification
      await ensureAuthenticated();

      // 2. Valider qu'on est dans un projet Directive
      await validateDirectiveProject();

      // 3. Obtenir le nom du projet
      const projectName = await getProjectName();
      const agentType = `${projectName}/${agentName}`;

      // 4. Récupérer l'agent via API
      const apiService = new ApiService();
      const agents = await apiService.getAgents();
      
      const agent = agents.find((a: any) => a.type === agentType);
      if (!agent) {
        console.log(chalk.red(`❌ Agent "${agentType}" non trouvé`));
        console.log(chalk.gray('💡 Vérifiez avec: directive list agents'));
        return;
      }

      // 5. Afficher les informations détaillées
      displayAgentStatus(agent, agentType);

    } catch (error) {
      console.error(chalk.red('❌ Erreur lors de la récupération du statut:'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

/**
 * Afficher le statut détaillé de l'agent
 */
function displayAgentStatus(agent: any, agentType: string): void {
  const statusIcon = getStatusIcon(agent.status);
  const statusColor = getStatusColor(agent.status);
  
  console.log(chalk.green('✅ Agent trouvé !\n'));
  
  // Informations générales
  console.log(chalk.blue('📋 Informations générales:'));
  console.log(`   ${statusIcon} Statut: ${statusColor(agent.status.toUpperCase())}`);
  console.log(chalk.gray(`   Nom: ${agent.name}`));
  console.log(chalk.gray(`   Type: ${agentType}`));
  console.log(chalk.gray(`   ID: ${agent.id}`));
  console.log(chalk.gray(`   Application: ${agent.applicationId}`));
  console.log(chalk.gray(`   Auteur: ${agent.author || agent.createdBy || 'Inconnu'}`));
  
  // Dates
  console.log(chalk.blue('\n📅 Historique:'));
  console.log(chalk.gray(`   Créé: ${new Date(agent.created_at || agent.createdAt).toLocaleString('fr-FR')}`));
  
  if (agent.lastDeployedAt) {
    console.log(chalk.gray(`   Dernier déploiement: ${new Date(agent.lastDeployedAt).toLocaleString('fr-FR')}`));
  } else {
    console.log(chalk.yellow('   ⚠️ Jamais déployé'));
  }
  
  // Description
  if (agent.description) {
    console.log(chalk.blue('\n📝 Description:'));
    console.log(chalk.gray(`   ${agent.description}`));
  }
  
  // Actions recommandées selon le statut
  console.log(chalk.blue('\n🚀 Actions recommandées:'));
  
  switch (agent.status) {
    case 'created':
      console.log(chalk.cyan('   • Déployer l\'agent: directive deploy agent ' + agent.name));
      break;
    case 'deployed':
      console.log(chalk.cyan('   • L\'agent est déployé et prêt à être utilisé'));
      break;
    case 'running':
      console.log(chalk.cyan('   • L\'agent fonctionne correctement'));
      break;
    case 'stopped':
      console.log(chalk.cyan('   • Redémarrer: directive deploy agent ' + agent.name));
      break;
    case 'error':
      console.log(chalk.red('   • Vérifier les logs d\'erreur'));
      console.log(chalk.cyan('   • Redéployer: directive deploy agent ' + agent.name + ' --force'));
      break;
    default:
      console.log(chalk.cyan('   • État inconnu, vérifier manuellement'));
  }
}

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
 * Valider qu'on est dans un projet Directive
 */
async function validateDirectiveProject(): Promise<void> {
  try {
    const fs = await import('fs/promises');
    await fs.access('./directive-conf.ts');
    await fs.access('./agents');
  } catch (error) {
    throw new Error('Pas dans un projet Directive. Exécutez cette commande depuis la racine d\'un projet Directive.');
  }
}

/**
 * Obtenir le nom du projet depuis directive-conf.ts
 */
async function getProjectName(): Promise<string> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const configPath = path.join(process.cwd(), 'directive-conf.ts');
    const configContent = await fs.readFile(configPath, 'utf-8');
    
    const nameMatch = configContent.match(/name:\s*['"`]([^'"`]+)['"`]/);
    if (!nameMatch) {
      throw new Error('Impossible de trouver le nom de l\'application dans directive-conf.ts');
    }
    
    return nameMatch[1];
  } catch (error) {
    throw new Error(`Impossible de lire la configuration du projet: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Obtenir l'icône du statut
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

/**
 * Obtenir la couleur du statut
 */
function getStatusColor(status: string): typeof chalk.green {
  switch (status) {
    case 'created': return chalk.yellow;
    case 'deployed': return chalk.blue;
    case 'running': return chalk.green;
    case 'stopped': return chalk.gray;
    case 'error': return chalk.red;
    default: return chalk.white;
  }
} 