import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import { execSync } from 'child_process';
// Utiliser FormData native de Node.js
import crypto from 'crypto';

import { ConfigService } from '../services/config.service.js';
import { ApiService } from '../services/api.service.js';
import type { UploadBundleRequest, UploadBundleResponse } from '../types/index.js';

interface DeployOptions {
  strategy?: 'strict' | 'auto-commit' | 'warn' | 'ignore';
  message?: string;
  force?: boolean;
}

export const deployCommand = new Command('deploy')
  .description('Deploy agent to server')
  .argument('<type>', 'Resource type (agent)')
  .argument('<name>', 'Agent name')
  .option('--strategy <strategy>', 'Git strategy for uncommitted changes', 'strict')
  .option('--message <message>', 'Commit message if using auto-commit strategy')
  .option('--force', 'Force deployment')
  .action(async (type: string, agentName: string, options?: DeployOptions) => {
    try {
      if (type !== 'agent') {
        throw new Error('Only "agent" deployment is supported. Usage: directive deploy agent <name>');
      }

      console.log(chalk.blue(`🚀 Deploying agent ${chalk.white(agentName)}...\n`));

      // 1. Check authentication
      await ensureAuthenticated();

      // 2. Validate Directive project
      await validateDirectiveProject();

      // 3. Get project name and build agent ID
      const projectName = await getProjectName();
      const agentType = `${projectName}/${agentName}`;
      const agentId = await getAgentId(agentName, projectName);

      console.log(chalk.gray(`   Agent: ${agentType}`));
      console.log(chalk.gray(`   Agent ID: ${agentId}`));

      // 4. Check that agent exists
      await validateAgentExists(agentName);

      // 5. Check Git status according to strategy
      await checkGitStatus(options);

      // 6. Compile agent
      console.log(chalk.yellow('📦 Compiling agent...'));
      await compileAgent(agentName);

      // 7. Prepare bundle for upload
      console.log(chalk.yellow('📋 Preparing bundle...'));
      const bundleData = await prepareBundleForUpload(agentName, options);

      // 8. Upload via REST API
      console.log(chalk.yellow('📤 Uploading to server...'));
      const result = await uploadBundleToServer(agentId, bundleData);

      // 9. Display result
      displayDeploymentResult(result, agentType);

    } catch (error) {
      console.error(chalk.red('❌ Deployment failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Check that user is authenticated
 */
async function ensureAuthenticated(): Promise<void> {
  const config = await ConfigService.load();
  
  if (!config.authToken) {
    throw new Error('Authentication required. Please run "directive login" first.');
  }
}

/**
 * Check that we are in a Directive project
 */
async function validateDirectiveProject(): Promise<void> {
  try {
    await fs.access('./directive-conf.ts');
    await fs.access('./agents');
  } catch (error) {
    throw new Error('Not in a Directive project. Run "directive create app" first.');
  }
}

/**
 * Get project name from directive-conf.ts
 */
async function getProjectName(): Promise<string> {
  try {
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
 * Get agent ID from database via API
 */
async function getAgentId(agentName: string, projectName: string): Promise<string> {
  try {
    const api = new ApiService();
    const agents = await api.getAgents();
    
    const agentType = `${projectName}/${agentName}`;
    const agent = agents.find((a: any) => a.type === agentType);
    
    if (!agent) {
      throw new Error(`Agent "${agentType}" not found in database. Create it first with "directive create agent ${agentName}"`);
    }
    
    return agent.id;
  } catch (error) {
    throw new Error(`Cannot retrieve agent ID: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Check that agent exists locally
 */
async function validateAgentExists(agentName: string): Promise<void> {
  const agentPath = path.join(process.cwd(), 'agents', agentName);
  const agentTsPath = path.join(agentPath, 'agent.ts');
  const agentJsonPath = path.join(agentPath, 'agent.json');

  try {
    await fs.access(agentPath);
    await fs.access(agentTsPath);
    await fs.access(agentJsonPath);
  } catch (error) {
    throw new Error(`Agent "${agentName}" not found in agents/${agentName}/. Create it first with "directive create agent ${agentName}"`);
  }
}

/**
 * Check Git status according to strategy
 */
async function checkGitStatus(options?: DeployOptions): Promise<void> {
  if (options?.strategy === 'ignore') {
    return;
  }

  try {
    const hasChanges = execSync('git status --porcelain', { 
      stdio: 'pipe', 
      encoding: 'utf8' 
    }).trim();
    
    if (hasChanges) {
      if (options?.strategy === 'strict') {
        throw new Error('Working directory has uncommitted changes. Commit first or use --strategy warn/ignore');
      } else if (options?.strategy === 'warn') {
        console.log(chalk.yellow('⚠️ Warning: Working directory has uncommitted changes'));
      } else if (options?.strategy === 'auto-commit') {
        console.log(chalk.yellow('📝 Auto-committing changes...'));
        const message = options.message || `Deploy agent: ${new Date().toISOString()}`;
        execSync(`git add . && git commit -m "${message}"`, { stdio: 'inherit' });
      }
    }
  } catch (error: any) {
    if (error.message.includes('Working directory has uncommitted changes')) {
      throw error;
    }
    // Git non disponible ou erreur - continuer en mode warn
    console.log(chalk.yellow('⚠️ Warning: Cannot check Git status'));
  }
}

/**
 * Compile l'agent via npm run build:agent
 */
async function compileAgent(agentName: string): Promise<void> {
  try {
    console.log(chalk.gray(`   Running: npm run build:agent ${agentName}`));
    
    execSync(`npm run build:agent -- --env agent=${agentName}`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    console.log(chalk.green('   ✅ Agent compiled successfully'));
  } catch (error: any) {
    throw new Error(`Agent compilation failed: ${error.message}`);
  }
}

/**
 * Prépare le bundle pour upload
 */
async function prepareBundleForUpload(agentName: string, options?: DeployOptions): Promise<{
  bundleBuffer: Buffer;
  metadata: UploadBundleRequest['metadata'];
  version: string;
}> {
  try {
    // 1. Chemins vers les fichiers
    const compiledJsPath = path.join(process.cwd(), 'dist', `${agentName}.js`);
    const agentJsonPath = path.join(process.cwd(), 'agents', agentName, 'agent.json');
    const packageJsonPath = path.join(process.cwd(), 'package.json');

    // 2. Vérifier que les fichiers existent
    try {
      await fs.access(compiledJsPath);
      await fs.access(agentJsonPath);
    } catch (error) {
      throw new Error(`Compiled agent not found at ${compiledJsPath}. Make sure compilation succeeded.`);
    }

    // 3. Lire le bundle compilé
    const bundleBuffer = await fs.readFile(compiledJsPath);

    // 4. Lire les métadonnées de l'agent
    const agentMetadata = JSON.parse(await fs.readFile(agentJsonPath, 'utf-8'));

    // 5. Lire les dépendances depuis package.json
    let dependencies: Record<string, string> = {};
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };
    } catch (error) {
      console.log(chalk.yellow('⚠️ Warning: Cannot read package.json dependencies'));
    }

    // 6. Calculer le hash du bundle
    const buildHash = crypto.createHash('sha256').update(bundleBuffer).digest('hex').substring(0, 16);

    // 7. Obtenir le commit Git (si disponible)
    let gitCommit: string | undefined;
    try {
      gitCommit = execSync('git rev-parse HEAD', { 
        stdio: 'pipe', 
        encoding: 'utf8' 
      }).trim().substring(0, 7);
    } catch (error) {
      // Git non disponible
    }

    // 8. Préparer les métadonnées
    const metadata: UploadBundleRequest['metadata'] = {
      buildHash,
      buildTime: new Date().toISOString(),
      dependencies,
      gitCommit
    };

    console.log(chalk.gray(`   Bundle size: ${(bundleBuffer.length / 1024).toFixed(1)} KB`));
    console.log(chalk.gray(`   Build hash: ${buildHash}`));
    if (gitCommit) {
      console.log(chalk.gray(`   Git commit: ${gitCommit}`));
    }

    return {
      bundleBuffer,
      metadata,
      version: agentMetadata.version
    };

  } catch (error) {
    throw new Error(`Failed to prepare bundle: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Upload le bundle au serveur via API REST
 */
async function uploadBundleToServer(agentId: string, bundleData: {
  bundleBuffer: Buffer;
  metadata: UploadBundleRequest['metadata'];
  version: string;
}): Promise<UploadBundleResponse> {
  try {
    const config = await ConfigService.load();
    
    // Créer FormData pour upload du fichier
    const formData = new FormData();
    
    // Créer un Blob pour le fichier bundle
    const bundleBlob = new Blob([bundleData.bundleBuffer], { 
      type: 'application/javascript' 
    });
    
    // Ajouter le fichier bundle
    formData.append('bundle', bundleBlob, `${agentId}.js`);

    // Ajouter les métadonnées
    formData.append('agentId', agentId);
    formData.append('version', bundleData.version);
    formData.append('metadata', JSON.stringify(bundleData.metadata));

    // Faire la requête HTTP avec fetch
    const response = await fetch(`${config.serverUrl}/api/deployments/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.authToken}`,
        // FormData native gère automatiquement le Content-Type
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result: any = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Upload failed');
    }

    return result.data;
  } catch (error) {
    throw new Error(`Failed to upload bundle: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Affiche le résultat du déploiement
 */
function displayDeploymentResult(result: UploadBundleResponse, agentType: string): void {
  console.log(chalk.green('\n🎉 Agent deployed successfully!'));
  
  console.log(chalk.blue('\n📋 Deployment details:'));
  console.log(chalk.gray(`   Agent: ${agentType}`));
  console.log(chalk.gray(`   Version: ${result.version}`));
  console.log(chalk.gray(`   Deployment ID: ${result.deploymentId}`));
  console.log(chalk.gray(`   Bundle size: ${(result.bundleSize / 1024).toFixed(1)} KB`));
  
  if (result.url) {
    console.log(chalk.gray(`   URL: ${result.url}`));
  }
  
  if (result.rollbackVersion) {
    console.log(chalk.gray(`   Previous version: ${result.rollbackVersion}`));
  }

  console.log(chalk.blue('\n📋 Next steps:'));
  console.log(chalk.cyan('   directive status agent <name>     # View agent status'));
  console.log(chalk.cyan('   directive list agents             # List all agents'));
  console.log(chalk.cyan('   curl <url>                        # Test the deployed agent'));
} 