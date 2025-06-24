import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';

import { ConfigService } from '../services/config.service.js';
import { ApiService } from '../services/api.service.js';

interface CreateAgentOptions {
  description?: string;
  author?: string;
}

interface AgentInfo {
  name: string;
  description: string;
  author: string;
  projectName: string;
  agentType: string;
}

export const createAgentCommand = new Command('agent')
  .description('Create a new directive agent')
  .argument('[agent-name]', 'Name of the agent to create')
  .option('-d, --description <description>', 'Agent description')
  .option('-a, --author <author>', 'Agent author')
  .action(async (agentName?: string, options?: CreateAgentOptions) => {
    try {
      console.log(chalk.blue('🤖 Creating new Directive agent...\n'));

      // 1. Vérifier l'authentification
      await ensureAuthenticated();

      // 2. Vérifier qu'on est dans un projet Directive
      await validateDirectiveProject();

      // 3. Obtenir le nom du projet (= application)
      const projectName = await getProjectName();

      // 4. Collecter les informations de l'agent
      const agentInfo = await collectAgentInfo(agentName, options, projectName);

      // 5. Valider le nom de l'agent
      await validateAgentName(agentInfo.name);

      // 6. Créer la structure de l'agent (génération locale)
      await createAgentStructure(agentInfo);

      // 7. Enregistrer dans la base de données via API REST
      await registerAgentViaAPI(agentInfo);

      // 8. Afficher le message de succès
      await displaySuccessMessage(agentInfo);

    } catch (error) {
      console.error(chalk.red('❌ Error creating agent:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Vérifie que l'utilisateur est authentifié
 */
async function ensureAuthenticated(): Promise<void> {
  const config = await ConfigService.load();
  
  if (!config.authToken) {
    throw new Error('Authentication required. Please run "directive login" first.');
  }
}

/**
 * Vérifie qu'on est dans un projet Directive valide
 */
async function validateDirectiveProject(): Promise<void> {
  const cwd = process.cwd();
  
  // Vérifier la présence du fichier de configuration Directive
  const configFile = path.join(cwd, 'directive-conf.ts');
  try {
    await fs.access(configFile);
  } catch {
    throw new Error('Not in a Directive project. Please run this command from a Directive project root directory.');
  }

  // Vérifier la présence du répertoire agents
  const agentsDir = path.join(cwd, 'agents');
  try {
    await fs.access(agentsDir);
  } catch {
    throw new Error('No "agents" directory found. Please run this command from a Directive project root directory.');
  }
}

/**
 * Obtient le nom du projet depuis directive-conf.ts
 */
async function getProjectName(): Promise<string> {
  try {
    const configPath = path.join(process.cwd(), 'directive-conf.ts');
    const configContent = await fs.readFile(configPath, 'utf-8');
    
    // Extraction du nom de l'application depuis la config
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
 * Récupère l'auteur du projet depuis la configuration
 */
async function getProjectAuthor(): Promise<string> {
  try {
    const configPath = path.join(process.cwd(), 'directive-conf.ts');
    const configContent = await fs.readFile(configPath, 'utf-8');
    
    // Extraction simple de l'auteur depuis la config
    const authorMatch = configContent.match(/author:\s*['"`]([^'"`]+)['"`]/);
    return authorMatch ? authorMatch[1] : 'Directive Team';
  } catch {
    return 'Directive Team';
  }
}

/**
 * Collecte les informations de l'agent
 */
async function collectAgentInfo(
  agentName?: string, 
  options?: CreateAgentOptions,
  projectName?: string
): Promise<AgentInfo> {
  const questions = [];

  // Nom de l'agent
  if (!agentName) {
    questions.push({
      type: 'input',
      name: 'name',
      message: 'Agent name:',
      validate: (input: string) => {
        if (!input.trim()) return 'Agent name is required';
        if (!/^[a-z0-9-_]+$/.test(input)) return 'Name must contain only lowercase letters, numbers, hyphens and underscores';
        if (input.length < 2) return 'Name must be at least 2 characters long';
        if (input.length > 50) return 'Name must be less than 50 characters';
        return true;
      }
    });
  }

  // Description
  if (!options?.description) {
    questions.push({
      type: 'input',
      name: 'description',
      message: 'Agent description:',
      default: (answers: any) => `AI directive agent ${answers.name || agentName}`
    });
  }

  // Récupérer l'auteur de la config en avance
  const defaultAuthor = await getProjectAuthor();

  // Auteur - seulement si pas fourni ET qu'on a d'autres questions (mode interactif)
  if (!options?.author && questions.length > 0) {
    questions.push({
      type: 'input',
      name: 'author',
      message: 'Agent author:',
      default: defaultAuthor
    });
  }

  const answers = await inquirer.prompt(questions);
  const finalAgentName = agentName || answers.name;
  const finalProjectName = projectName || 'unknown-project';

  return {
    name: finalAgentName,
    description: options?.description || answers.description,
    author: options?.author || answers.author || defaultAuthor,
    projectName: finalProjectName,
    agentType: `${finalProjectName}/${finalAgentName}`
  };
}

/**
 * Valide le nom de l'agent
 */
async function validateAgentName(agentName: string): Promise<void> {
  const agentPath = path.join(process.cwd(), 'agents', agentName);

  // Vérifier que l'agent n'existe pas déjà
  try {
    await fs.access(agentPath);
    throw new Error(`Agent "${agentName}" already exists in agents/${agentName}/`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      throw error;
    }
  }

  // Validation du format du nom
  if (!/^[a-z0-9-_]+$/.test(agentName)) {
    throw new Error('Agent name must contain only lowercase letters, numbers, hyphens and underscores');
  }

  if (agentName.length < 2 || agentName.length > 50) {
    throw new Error('Agent name must be between 2 and 50 characters');
  }

  // Vérifier les noms réservés
  const reservedNames = ['core', 'system', 'admin', 'api', 'config', 'lib', 'utils', 'test', 'src', 'index'];
  if (reservedNames.includes(agentName)) {
    throw new Error(`"${agentName}" is a reserved name. Please choose a different agent name.`);
  }
}

/**
 * Crée la structure de l'agent (génération locale)
 */
async function createAgentStructure(agentInfo: AgentInfo): Promise<void> {
  console.log(chalk.yellow('📁 Creating agent structure...'));

  const agentPath = path.join(process.cwd(), 'agents', agentInfo.name);

  // Créer le répertoire de l'agent
  await fs.mkdir(agentPath, { recursive: true });

  // 1. Générer agent.ts avec machine XState
  await generateAgentTypeScript(agentPath, agentInfo);

  // 2. Générer agent.json avec métadonnées
  await generateAgentMetadata(agentPath, agentInfo);

  // 3. Générer desc.mdx avec documentation
  await generateAgentDocumentation(agentPath, agentInfo);

  console.log(chalk.green(`✅ Agent structure created in agents/${agentInfo.name}/`));
}

/**
 * Charge un template et remplace les placeholders
 */
async function loadAndRenderTemplate(templateName: string, variables: Record<string, string>): Promise<string> {
  // Utiliser le chemin des templates locaux
  const templatePath = path.join(import.meta.dirname || __dirname, '..', 'templates', templateName);
  const template = await fs.readFile(templatePath, 'utf-8');
  
  // Remplacer tous les placeholders {{variable}} par leurs valeurs
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(placeholder, value);
  }
  
  return result;
}

/**
 * Génère le fichier agent.ts avec machine XState
 */
async function generateAgentTypeScript(agentPath: string, agentInfo: AgentInfo): Promise<void> {
  const variables = {
    agentName: agentInfo.name,
    description: agentInfo.description,
    agentType: agentInfo.agentType,
    author: agentInfo.author,
    PascalCaseName: toPascalCase(agentInfo.name),
    camelCaseName: toCamelCase(agentInfo.name)
  };
  
  const agentContent = await loadAndRenderTemplate('agent.ts.template', variables);
  await fs.writeFile(path.join(agentPath, 'agent.ts'), agentContent);
}

/**
 * Génère le fichier agent.json avec métadonnées
 */
async function generateAgentMetadata(agentPath: string, agentInfo: AgentInfo): Promise<void> {
  const agentId = generateAgentId(agentInfo.projectName, agentInfo.name);
  
  const variables = {
    agentId: agentId,
    agentName: agentInfo.name,
    agentType: agentInfo.agentType,
    description: agentInfo.description,
    author: agentInfo.author,
    projectName: agentInfo.projectName,
    createdAt: new Date().toISOString()
  };

  const metadataContent = await loadAndRenderTemplate('agent.json.template', variables);
  await fs.writeFile(path.join(agentPath, 'agent.json'), metadataContent);
}

/**
 * Génère le fichier desc.mdx avec documentation
 */
async function generateAgentDocumentation(agentPath: string, agentInfo: AgentInfo): Promise<void> {
  const variables = {
    agentName: agentInfo.name,
    description: agentInfo.description,
    agentType: agentInfo.agentType,
    author: agentInfo.author,
    projectName: agentInfo.projectName,
    camelCaseName: toCamelCase(agentInfo.name),
    createdDateFr: new Date().toLocaleDateString('fr-FR')
  };

  const documentationContent = await loadAndRenderTemplate('desc.mdx.template', variables);
  await fs.writeFile(path.join(agentPath, 'desc.mdx'), documentationContent);
}

/**
 * Génère un ID unique pour l'agent
 */
function generateAgentId(projectName: string, agentName: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 5);
  return `agent_${projectName}_${agentName}_${timestamp}_${random}`;
}

/**
 * Enregistre l'agent via l'API REST
 */
async function registerAgentViaAPI(agentInfo: AgentInfo): Promise<void> {
  console.log(chalk.yellow('📝 Registering agent via API...'));
  
  try {
    const api = new ApiService();
    
    // D'abord, récupérer l'application ou la créer si elle n'existe pas
    const applications = await api.getApplications();
    let app = applications.find((a: any) => a.name === agentInfo.projectName);
    
    if (!app) {
      // Auto-créer l'application pour ce projet
      console.log(chalk.blue(`ℹ️ Creating application "${agentInfo.projectName}"...`));
      
      app = await api.createApplication({
        name: agentInfo.projectName,
        description: `Application for project ${agentInfo.projectName}`
      });
      
      console.log(chalk.blue(`✅ Application "${agentInfo.projectName}" created`));
    }

    // Maintenant créer l'agent
    const createAgentRequest = {
      name: agentInfo.name,
      type: agentInfo.agentType,
      applicationId: app.id,
      description: agentInfo.description
    };

    await api.createAgent(createAgentRequest);
    
    console.log(chalk.green(`✅ Agent registered with type "${agentInfo.agentType}"`));
    
  } catch (error) {
    console.warn(chalk.yellow('⚠️ Warning: Could not register agent via API'));
    console.warn(chalk.gray(`   ${error instanceof Error ? error.message : error}`));
    console.warn(chalk.gray('   The agent files were created successfully.'));
  }
}

/**
 * Affiche le message de succès
 */
async function displaySuccessMessage(agentInfo: AgentInfo): Promise<void> {
  console.log(chalk.green('\n🎉 Agent created successfully!\n'));
  
  console.log(chalk.white('📁 Created files:'));
  console.log(chalk.gray(`   agents/${agentInfo.name}/agent.ts`));
  console.log(chalk.gray(`   agents/${agentInfo.name}/agent.json`));
  console.log(chalk.gray(`   agents/${agentInfo.name}/desc.mdx`));
  
  console.log(chalk.white('\n📝 Agent details:'));
  console.log(chalk.gray(`   Name: ${agentInfo.name}`));
  console.log(chalk.gray(`   Type: ${agentInfo.agentType}`));
  console.log(chalk.gray(`   Author: ${agentInfo.author}`));
  console.log(chalk.gray(`   Project: ${agentInfo.projectName}`));
  
  console.log(chalk.white('\n🚀 Next steps:'));
  console.log(chalk.cyan(`   1. Edit the logic in agents/${agentInfo.name}/agent.ts`));
  console.log(chalk.cyan(`   2. Deploy the agent: directive deploy agent ${agentInfo.name}`));
  console.log(chalk.cyan(`   3. View status: directive status agent ${agentInfo.name}`));
  console.log(chalk.cyan(`   4. List all agents: directive list agents\n`));
}

/**
 * Convertit une chaîne en PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Convertit une chaîne en camelCase
 */
function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
} 