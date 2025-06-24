import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { ConfigService } from '../services/config.service.js';
import { ApiService } from '../services/api.service.js';

interface DeleteOptions {
  all?: boolean;
  version?: string;
  force?: boolean;
}

/**
 * Commande directive delete - Supprimer des ressources
 */
export const deleteCommand = new Command('delete')
  .description('Delete resources (applications and agents)');

// Sous-commande: delete app
const deleteAppCommand = new Command('app')
  .description('Delete an application')
  .argument('<app-name>', 'Name or ID of the application to delete')
  .option('--force', 'Skip confirmation prompt')
  .action(async (appName: string, options?: DeleteOptions) => {
    try {
      console.log(chalk.blue(`🗑️ Deleting application ${chalk.white(appName)}...\n`));

      // 1. Check authentication
      await ensureAuthenticated();

      // 2. Get application details via API
      const apiService = new ApiService();
      const applications = await apiService.getApplications();
      
      const app = applications.find((a: any) => a.name === appName || a.id === appName);
      if (!app) {
        console.log(chalk.red(`❌ Application "${appName}" not found`));
        console.log(chalk.gray('💡 List available applications with: directive list apps'));
        return;
      }

      // 3. Show application details
      console.log(chalk.yellow('⚠️ You are about to delete:'));
      console.log(chalk.gray(`   Name: ${app.name}`));
      console.log(chalk.gray(`   ID: ${app.id}`));
      console.log(chalk.gray(`   Author: ${app.createdBy || 'Unknown'}`));
      console.log(chalk.gray(`   Agents: ${app.agents?.length || 0}`));
      console.log('');

      // 4. Confirm deletion
      if (!options?.force) {
        const { confirmed } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirmed',
          message: `Are you sure you want to delete application "${app.name}"?`,
          default: false
        }]);

        if (!confirmed) {
          console.log(chalk.yellow('⏹️ Deletion cancelled'));
          return;
        }
      }

      // 5. Delete via API
      console.log(chalk.yellow('🗑️ Deleting application...'));
      await apiService.deleteApplication(appName);
      
      console.log(chalk.green(`✅ Application "${app.name}" deleted successfully!`));

    } catch (error) {
      console.error(chalk.red('❌ Error deleting application:'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// Sous-commande: delete agent
const deleteAgentCommand = new Command('agent')
  .description('Delete an agent or agent version')
  .argument('<agent-name>', 'Name of the agent to delete')
  .option('--all', 'Delete all versions and the agent itself')
  .option('--version <version>', 'Delete a specific version only')
  .option('--force', 'Skip confirmation prompt')
  .action(async (agentName: string, options?: DeleteOptions) => {
    try {
      if (options?.all && options?.version) {
        throw new Error('Cannot use --all and --version options together');
      }

      if (!options?.all && !options?.version) {
        throw new Error('Must specify either --all or --version <version>');
      }

      console.log(chalk.blue(`🗑️ Deleting agent ${chalk.white(agentName)}...\n`));

      // 1. Check authentication
      await ensureAuthenticated();

      // 2. Validate Directive project
      await validateDirectiveProject();

      // 3. Get project name and build agent type
      const projectName = await getProjectName();
      const agentType = `${projectName}/${agentName}`;

      // 4. Get agent details via API
      const apiService = new ApiService();
      const agents = await apiService.getAgents();
      
      const agent = agents.find((a: any) => a.type === agentType);
      if (!agent) {
        console.log(chalk.red(`❌ Agent "${agentType}" not found`));
        console.log(chalk.gray('💡 List available agents with: directive list agents'));
        return;
      }

      if (options?.all) {
        // Delete entire agent
        await deleteEntireAgent(agent, agentName, options.force);
      } else if (options?.version) {
        // Delete specific version
        await deleteAgentVersion(agent.id, options.version, agentName, options.force);
      }

    } catch (error) {
      console.error(chalk.red('❌ Error deleting agent:'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// Ajouter les sous-commandes
deleteCommand.addCommand(deleteAppCommand);
deleteCommand.addCommand(deleteAgentCommand);

/**
 * Delete entire agent with all versions
 */
async function deleteEntireAgent(agent: any, agentName: string, force?: boolean): Promise<void> {
  console.log(chalk.yellow('⚠️ You are about to delete:'));
  console.log(chalk.gray(`   Agent: ${agent.type}`));
  console.log(chalk.gray(`   ID: ${agent.id}`));
  console.log(chalk.gray(`   Status: ${agent.status}`));
  console.log(chalk.gray(`   Author: ${agent.createdBy}`));
  console.log(chalk.gray(`   This will delete ALL versions and the agent itself`));
  console.log('');

  if (!force) {
    const { confirmed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message: `Are you sure you want to PERMANENTLY delete agent "${agentName}" and ALL its versions?`,
      default: false
    }]);

    if (!confirmed) {
      console.log(chalk.yellow('⏹️ Deletion cancelled'));
      return;
    }
  }

  console.log(chalk.yellow('🗑️ Deleting agent and all versions...'));
  
  const apiService = new ApiService();
  
  // Supprimer d'abord tous les bundles stockés
  try {
    await apiService.deleteAllAgentVersions(agent.id);
    console.log(chalk.gray('   ✅ All bundle versions deleted'));
  } catch (error) {
    console.log(chalk.yellow('   ⚠️ Warning: Could not delete bundle versions'));
  }
  
  // Ensuite supprimer l'agent de la base de données
  await apiService.deleteAgent(agent.id);
  
  console.log(chalk.green(`✅ Agent "${agentName}" and all versions deleted successfully!`));
}

/**
 * Delete specific agent version
 */
async function deleteAgentVersion(agentId: string, version: string, agentName: string, force?: boolean): Promise<void> {
  // First get the versions to validate the version exists
  const apiService = new ApiService();
  const versions = await apiService.getAgentVersions(agentId);
  
  const versionToDelete = versions.find((v: any) => v.version === version);
  if (!versionToDelete) {
    console.log(chalk.red(`❌ Version "${version}" not found for agent "${agentName}"`));
    console.log(chalk.gray('💡 List available versions with: directive list agents --versions ' + agentName));
    return;
  }

  if (versionToDelete.status === 'active') {
    console.log(chalk.red(`❌ Cannot delete active version "${version}"`));
    console.log(chalk.gray('💡 Rollback to another version first, then delete this version'));
    return;
  }

  console.log(chalk.yellow('⚠️ You are about to delete:'));
  console.log(chalk.gray(`   Agent: ${agentName}`));
  console.log(chalk.gray(`   Version: ${version}`));
  console.log(chalk.gray(`   Status: ${versionToDelete.status}`));
  console.log(chalk.gray(`   Size: ${(versionToDelete.bundleSize / 1024).toFixed(1)} KB`));
  console.log(chalk.gray(`   Deployed: ${new Date(versionToDelete.deployedAt).toLocaleDateString('en-US')}`));
  console.log('');

  if (!force) {
    const { confirmed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message: `Are you sure you want to delete version "${version}" of agent "${agentName}"?`,
      default: false
    }]);

    if (!confirmed) {
      console.log(chalk.yellow('⏹️ Deletion cancelled'));
      return;
    }
  }

  console.log(chalk.yellow(`🗑️ Deleting version ${version}...`));
  
  await apiService.deleteAgentVersion(agentId, version);
  
  console.log(chalk.green(`✅ Version "${version}" of agent "${agentName}" deleted successfully!`));
}

/**
 * Check that user is authenticated
 */
async function ensureAuthenticated(): Promise<void> {
  const isLoggedIn = await ConfigService.isLoggedIn();
  if (!isLoggedIn) {
    throw new Error('Authentication required. Use: directive login');
  }
}

/**
 * Check that we are in a Directive project
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
 * Get project name from directive-conf.ts
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