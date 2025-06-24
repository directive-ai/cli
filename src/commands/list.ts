import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigService } from '../services/config.service.js';
import { ApiService } from '../services/api.service.js';

interface ListOptions {
  app?: string;
  status?: string;
  versions?: string;
}

/**
 * Commande directive list - Afficher les ressources de l'utilisateur
 */
export const listCommand = new Command('list')
  .description('List resources (applications and agents)');

// Sous-commande: list apps
const listAppsCommand = new Command('apps')
  .description('List applications')
  .action(async () => {
    try {
      console.log(chalk.blue('📋 Applications list\n'));

      // 1. Vérifier l'authentification
      await ensureAuthenticated();

      // 2. Récupérer les applications via API
      const apiService = new ApiService();
      const applications = await apiService.getApplications();

      // 3. Afficher les résultats
      if (applications.length === 0) {
        console.log(chalk.yellow('⚠️  No applications found'));
        console.log(chalk.gray('💡 Create your first application with: directive create app'));
        return;
      }

      console.log(chalk.green(`✅ ${applications.length} application(s) found:\n`));

      applications.forEach((app: any, index) => {
        console.log(chalk.white(`${index + 1}. ${chalk.bold(app.name)} (${app.id})`));
        console.log(chalk.gray(`   Description: ${app.description || 'No description'}`));
        console.log(chalk.gray(`   Author: ${app.author || app.createdBy || 'Unknown'}`));
        console.log(chalk.gray(`   Version: ${app.version || '1.0.0'}`));
        console.log(chalk.gray(`   Agents: ${app.agents_count || app.agents?.length || 0}`));
        console.log(chalk.gray(`   Created: ${new Date(app.created_at || app.createdAt).toLocaleDateString('en-US')}`));
        console.log('');
      });

    } catch (error) {
      console.error(chalk.red('❌ Error retrieving applications:'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// Sous-commande: list agents
const listAgentsCommand = new Command('agents')
  .description('List agents')
  .option('-a, --app <app>', 'Filter by application (name or ID)')
  .option('-s, --status <status>', 'Filter by status (created, deployed, running, stopped, error)')
  .option('--versions <agent-name>', 'List all versions of a specific agent')
  .action(async (options: ListOptions) => {
    try {
      // 1. Vérifier l'authentification
      await ensureAuthenticated();

      // 2. Si --versions est spécifié, lister les versions d'un agent spécifique
      if (options.versions) {
        await listAgentVersions(options.versions);
        return;
      }

      console.log(chalk.blue('📋 Agents list\n'));

      // 3. Récupérer les agents via API
      const apiService = new ApiService();
      let agents = await apiService.getAgents(options.app);

      // 3. Appliquer les filtres
      if (options.app) {
        const appFilter = options.app;
        agents = agents.filter(agent => 
          agent.applicationId === appFilter || 
          agent.type.includes(appFilter)
        );
        console.log(chalk.gray(`🔍 Filtered by application: ${appFilter}`));
      }

      if (options.status) {
        agents = agents.filter(agent => agent.status === options.status);
        console.log(chalk.gray(`🔍 Filtered by status: ${options.status}\n`));
      }

      // 4. Afficher les résultats
      if (agents.length === 0) {
        console.log(chalk.yellow('⚠️  No agents found'));
        console.log(chalk.gray('💡 Create your first agent with: directive create agent'));
        return;
      }

      console.log(chalk.green(`✅ ${agents.length} agent(s) found:\n`));

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
          console.log(chalk.gray(`      Description: ${agent.description || 'No description'}`));
          console.log(chalk.gray(`      Status: ${agent.status}`));
          console.log(chalk.gray(`      Author: ${agent.author}`));
          console.log(chalk.gray(`      Created: ${new Date(agent.created_at).toLocaleDateString('en-US')}`));
          
          if (agent.lastDeployedAt) {
            console.log(chalk.gray(`      Deployed: ${new Date(agent.lastDeployedAt).toLocaleDateString('en-US')}`));
          }
          console.log('');
        });
      });

    } catch (error) {
      console.error(chalk.red('❌ Error retrieving agents:'));
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
    throw new Error('Authentication required. Use: directive login');
  }
}

/**
 * Lister toutes les versions d'un agent spécifique
 */
async function listAgentVersions(agentName: string): Promise<void> {
  try {
    console.log(chalk.blue(`📋 Versions of agent ${chalk.white(agentName)}\n`));

    // 1. Valider qu'on est dans un projet Directive
    await validateDirectiveProject();

    // 2. Obtenir le nom du projet
    const projectName = await getProjectName();
    const agentType = `${projectName}/${agentName}`;

    // 3. Récupérer l'agent via API
    const apiService = new ApiService();
    const agents = await apiService.getAgents();
    
    const agent = agents.find((a: any) => a.type === agentType);
    if (!agent) {
      console.log(chalk.red(`❌ Agent "${agentType}" not found`));
      console.log(chalk.gray('💡 List available agents with: directive list agents'));
      return;
    }

    // 4. Récupérer les versions
    const versions = await apiService.getAgentVersions(agent.id);

    if (versions.length === 0) {
      console.log(chalk.yellow('⚠️  No versions found for this agent'));
      console.log(chalk.gray('💡 Deploy the agent first with: directive deploy agent ' + agentName));
      return;
    }

    console.log(chalk.green(`✅ ${versions.length} version(s) found for agent "${agentName}":\n`));

    versions.forEach((version: any, index) => {
      const statusIcon = version.status === 'active' ? '🚀' : '📦';
      const statusColor = version.status === 'active' ? chalk.green : chalk.gray;
      
      console.log(`${index + 1}. ${statusIcon} ${chalk.bold(version.version)} ${statusColor(`(${version.status})`)}`);
      console.log(chalk.gray(`   Size: ${(version.bundleSize / 1024).toFixed(1)} KB`));
      console.log(chalk.gray(`   Deployed: ${new Date(version.deployedAt).toLocaleDateString('en-US')}`));
      
      if (version.metadata?.buildHash) {
        console.log(chalk.gray(`   Build hash: ${version.metadata.buildHash}`));
      }
      
      if (version.metadata?.gitCommit) {
        console.log(chalk.gray(`   Git commit: ${version.metadata.gitCommit}`));
      }
      
      if (version.url) {
        console.log(chalk.gray(`   URL: ${version.url}`));
      }
      
      console.log('');
    });

    console.log(chalk.blue('📋 Management commands:'));
    console.log(chalk.cyan(`   directive deploy agent ${agentName}                    # Deploy new version`));
    console.log(chalk.cyan(`   directive status agent ${agentName}                    # View current status`));
    console.log(chalk.cyan(`   directive delete agent ${agentName} --version <v>      # Delete specific version`));

  } catch (error) {
    console.error(chalk.red('❌ Error retrieving agent versions:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
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
    throw new Error('Not in a Directive project. Run this command from the root of a Directive project.');
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
      throw new Error('Cannot find application name in directive-conf.ts');
    }
    
    return nameMatch[1];
  } catch (error) {
    throw new Error(`Cannot read project configuration: ${error instanceof Error ? error.message : error}`);
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