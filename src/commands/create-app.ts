import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import { ConfigService } from '../services/config.service.js';
import { ApiService } from '../services/api.service.js';
import { CreateApplicationRequest } from '../types/index.js';

interface CreateAppOptions {
  author?: string;
  description?: string;
  skipInstall?: boolean;
}

interface ProjectInfo {
  name: string;
  author: string;
  description: string;
  skipInstall: boolean;
}

/**
 * Commande directive create app - Création d'une nouvelle application
 * Génère la structure locale ET crée l'entrée via API REST
 */
export const createAppCommand = new Command('app')
  .description('Create a new Directive application')
  .argument('[app-name]', 'Name of the application to create')
  .option('--author <author>', 'Application author (default from CLI config)')
  .option('--description <description>', 'Application description')
  .option('--skip-install', 'Skip automatic npm install')
  .action(async (appName: string | undefined, options: CreateAppOptions) => {
    try {
      console.log(chalk.blue('📱 Creating new Directive application...\n'));

      // 1. Vérifier l'authentification
      const isLoggedIn = await ConfigService.isLoggedIn();
      if (!isLoggedIn) {
        console.error(chalk.red('❌ You must be logged in to create an application.'));
        console.log(chalk.yellow('💡 Use: directive login'));
        process.exit(1);
      }

      // 2. Récupérer le nom de l'application (interactif si pas fourni)
      const finalAppName = await getApplicationName(appName);

      // 3. Valider le nom de l'application
      if (!/^[a-z0-9-_]+$/.test(finalAppName)) {
        console.error(chalk.red('❌ Application name must contain only lowercase letters, numbers, hyphens and underscores.'));
        process.exit(1);
      }

      // 4. Vérifier que le répertoire n'existe pas
      if (await fs.pathExists(finalAppName)) {
        console.error(chalk.red(`❌ Directory ${finalAppName} already exists.`));
        process.exit(1);
      }

              // 5. Collecter les informations
        const projectInfo = await collectProjectInfo(finalAppName, options);
        
        // 6. Créer l'application via API REST
        await createApplicationInDatabase(projectInfo);
        
        // 7. Générer la structure de projet locale
        await createProjectStructure(projectInfo);
        
        // 8. Générer les fichiers de configuration
        await generateProjectFiles(projectInfo);
        
        // 9. Installer les dépendances
        if (!projectInfo.skipInstall) {
          await installDependencies(projectInfo.name);
        }
        
        // 10. Afficher le succès
        displaySuccessMessage(projectInfo);
      
    } catch (error) {
      console.error(chalk.red('❌ Error creating application:'), 
        error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Récupère le nom de l'application de manière interactive si pas fourni
 */
async function getApplicationName(providedName: string | undefined): Promise<string> {
  if (providedName) {
    return providedName;
  }

  const answer = await inquirer.prompt([
    {
      type: 'input',
      name: 'appName',
      message: 'Application name:',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Application name is required';
        }
        if (!/^[a-z0-9-_]+$/.test(input)) {
          return 'Application name must contain only lowercase letters, numbers, hyphens and underscores';
        }
        return true;
      }
    }
  ]);

  return answer.appName;
}

/**
 * Collecte les informations du projet
 */
async function collectProjectInfo(appName: string, options: CreateAppOptions): Promise<ProjectInfo> {
  const config = await ConfigService.load();
  const defaultAuthor = config.preferences?.defaultAuthor || 'Directive Developer';

  const questions = [];

  // Auteur (utilise la config CLI par défaut)
  if (!options.author) {
    questions.push({
      type: 'input',
      name: 'author',
      message: 'Author:',
      default: defaultAuthor
    });
  }

  // Description
  if (!options.description) {
    questions.push({
      type: 'input',
      name: 'description',
      message: 'Description:',
      default: `Directive agents application ${appName}`
    });
  }

  // Prompt seulement si nécessaire
  let answers: any = {};
  if (questions.length > 0) {
    answers = await inquirer.prompt(questions);
  }

  return {
    name: appName,
    author: options.author || answers.author || defaultAuthor,
    description: options.description || answers.description || `Directive agents application ${appName}`,
    skipInstall: options.skipInstall || false
  };
}

/**
 * Crée l'application dans la base de données via API REST
 */
async function createApplicationInDatabase(projectInfo: ProjectInfo): Promise<void> {
  console.log(chalk.yellow('🌐 Creating application in database...'));

  const request: CreateApplicationRequest = {
    name: projectInfo.name,
    description: projectInfo.description
  };

  const apiService = new ApiService();
  await apiService.createApplication(request);
  // La méthode createApplication gère déjà les erreurs et retourne directement l'Application

  console.log(chalk.green('✅ Application created in database'));
}

/**
 * Crée la structure de répertoires du projet
 */
async function createProjectStructure(projectInfo: ProjectInfo): Promise<void> {
  console.log(chalk.yellow('📁 Creating project structure...'));

  const directories = [
    projectInfo.name,
    `${projectInfo.name}/agents`,
    `${projectInfo.name}/dist`
  ];

  for (const dir of directories) {
    await fs.ensureDir(dir);
  }

  // Créer le fichier .gitkeep pour le répertoire agents
  await fs.writeFile(`${projectInfo.name}/agents/.gitkeep`, '');

  console.log(chalk.green(`✅ Project structure created`));
}

/**
 * Génère tous les fichiers de configuration
 */
async function generateProjectFiles(projectInfo: ProjectInfo): Promise<void> {
  console.log(chalk.yellow('📝 Generating configuration files...'));

  await Promise.all([
    generatePackageJson(projectInfo),
    generateTsConfig(projectInfo),
    generateWebpackConfig(projectInfo),
    generateDirectiveConfig(projectInfo),
    generateReadme(projectInfo),
    generateGitignore(projectInfo)
  ]);

  console.log(chalk.green('✅ Configuration files generated'));
}

/**
 * Génère le package.json
 */
async function generatePackageJson(projectInfo: ProjectInfo): Promise<void> {
  const packageJson = {
    name: projectInfo.name,
    version: "1.0.0",
    description: projectInfo.description,
    author: projectInfo.author,
    main: "index.js",
    scripts: {
      "build": "webpack --mode production",
      "build:agent": "webpack --mode production --env agent",
      "dev": "webpack --mode development --watch",
      "start": "directive start",
      "deploy": "directive deploy agent",
      "list": "directive list agents",
      "test": "jest"
    },
    devDependencies: {
      "@directive/sdk": "^1.0.0",
      "typescript": "~5.8.0",
      "xstate": "^5.20.0",
      "@types/node": "^24.0.0",
      "jest": "^30.0.0",
      "@types/jest": "^30.0.0",
      "webpack": "^5.89.0",
      "webpack-cli": "^5.1.4",
      "ts-loader": "^9.5.1"
    },
    keywords: ["directive", "agents", "ai", "workflow"],
    license: "MIT"
  };

  await fs.writeJSON(`${projectInfo.name}/package.json`, packageJson, { spaces: 2 });
}

/**
 * Génère la configuration TypeScript
 */
async function generateTsConfig(projectInfo: ProjectInfo): Promise<void> {
  const tsConfig = {
    compilerOptions: {
      target: "ES2020",
      module: "ESNext",
      moduleResolution: "bundler",
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      strict: false,
      noImplicitAny: false,
      strictNullChecks: false,
      outDir: "./dist",
      baseUrl: "./",
      paths: {
        "@/*": ["./agents/*"]
      }
    },
    include: ["agents/**/*"],
    exclude: ["node_modules", "dist"]
  };

  await fs.writeJSON(`${projectInfo.name}/tsconfig.json`, tsConfig, { spaces: 2 });
}

/**
 * Génère la configuration Webpack
 */
async function generateWebpackConfig(projectInfo: ProjectInfo): Promise<void> {
  const webpackConfig = `const path = require('path');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const isAgent = env && env.agent;
  
  return {
    mode: isProduction ? 'production' : 'development',
    entry: isAgent ? \`./agents/\${env.agent}/agent.ts\` : './agents/**/agent.ts',
    externals: {
      'xstate': 'commonjs xstate'
    },
    module: {
      rules: [{
        test: /\\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }]
    },
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'agents')
      }
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isAgent ? \`\${env.agent}.js\` : '[name].js',
      library: 'Agent',
      libraryTarget: 'commonjs2',
      clean: true
    },
    target: 'node'
  };
};
`;

  await fs.writeFile(`${projectInfo.name}/webpack.config.js`, webpackConfig);
}

/**
 * Génère la configuration Directive
 */
async function generateDirectiveConfig(projectInfo: ProjectInfo): Promise<void> {
  const directiveConfig = `// Configuration Directive pour l'application
export default {
  application: {
    name: '${projectInfo.name}',
    description: '${projectInfo.description}',
    author: '${projectInfo.author}',
    version: '1.0.0',
    metadata: {
      category: 'agents',
      tags: ['directive', 'ai', 'agents']
    }
  }
};
`;

  await fs.writeFile(`${projectInfo.name}/directive-conf.ts`, directiveConfig);
}

/**
 * Génère le README.md
 */
async function generateReadme(projectInfo: ProjectInfo): Promise<void> {
  const readmeContent = `# ${projectInfo.name}

${projectInfo.description}

## Overview

This is a **Directive application** that orchestrates AI agents using state machines (XState).

**Author**: ${projectInfo.author}  
**Version**: 1.0.0

## Quick Start

### 1. Install Dependencies
\`\`\`bash
npm install
\`\`\`

### 2. Create Your First Agent
\`\`\`bash
directive create agent my-agent
\`\`\`

### 3. Deploy Your Agent
\`\`\`bash
directive deploy agent my-agent
\`\`\`

### 4. Start the Server
\`\`\`bash
directive start
\`\`\`

## Available Commands

\`\`\`bash
directive create agent <name>    # Create a new agent
directive deploy agent <name>    # Deploy an agent
directive list agents            # List all agents
directive start                  # Start the server
\`\`\`

## Project Structure

\`\`\`
${projectInfo.name}/
├── agents/                 # AI agents directory
│   └── .gitkeep           # Placeholder
├── directive-conf.ts      # Application configuration
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
├── webpack.config.js      # Build configuration
└── README.md              # This file
\`\`\`

---

Your Directive application is ready! 🚀

Create your first agent:
\`\`\`bash
directive create agent my-first-agent
\`\`\`
`;

  await fs.writeFile(`${projectInfo.name}/README.md`, readmeContent);
}

/**
 * Génère le .gitignore
 */
async function generateGitignore(projectInfo: ProjectInfo): Promise<void> {
  const gitignoreContent = `# Dependencies
node_modules/
package-lock.json

# Build outputs
dist/
*.tgz

# Environment files
.env
.env.local

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Coverage
coverage/
`;

  await fs.writeFile(`${projectInfo.name}/.gitignore`, gitignoreContent);
}

/**
 * Installe les dépendances npm
 */
async function installDependencies(projectName: string): Promise<void> {
  console.log(chalk.yellow('📦 Installing dependencies...'));
  
  return new Promise((resolve, reject) => {
    const npmInstall = spawn('npm', ['install'], {
      cwd: path.resolve(projectName),
      stdio: 'pipe'
    });

    npmInstall.stdout?.on('data', (data) => {
      process.stdout.write(chalk.gray(data.toString()));
    });

    npmInstall.stderr?.on('data', (data) => {
      process.stderr.write(chalk.yellow(data.toString()));
    });

    npmInstall.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green('✅ Dependencies installed'));
        resolve();
      } else {
        reject(new Error(`npm install failed with code ${code}`));
      }
    });

    npmInstall.on('error', (error) => {
      reject(new Error(`Failed to start npm install: ${error.message}`));
    });
  });
}

/**
 * Affiche le message de succès
 */
function displaySuccessMessage(projectInfo: ProjectInfo): void {
  console.log(chalk.green('\n🎉 Directive application created successfully!\n'));
  
  console.log(chalk.blue('📋 Application Details:'));
  console.log(chalk.gray(`   Name: ${projectInfo.name}`));
  console.log(chalk.gray(`   Author: ${projectInfo.author}`));
  console.log(chalk.gray(`   Description: ${projectInfo.description}`));
  
  console.log(chalk.blue('\n🏗️ Architecture:'));
  console.log(chalk.gray('   ✅ Database: Created via API REST'));
  console.log(chalk.gray('   ✅ Local project: Generated'));
  console.log(chalk.gray('   ✅ Configuration: directive-conf.ts'));
  
  console.log(chalk.blue('\n📚 Next steps:'));
  console.log(chalk.gray(`   1. cd ${projectInfo.name}`));
  
  if (projectInfo.skipInstall) {
    console.log(chalk.gray('   2. npm install'));
    console.log(chalk.gray('   3. directive create agent <agent-name>'));
    console.log(chalk.gray('   4. directive deploy agent <agent-name>'));
  } else {
    console.log(chalk.gray('   2. directive create agent <agent-name>'));
    console.log(chalk.gray('   3. directive deploy agent <agent-name>'));
  }
  
  console.log(chalk.blue('\n🌟 Happy coding with Directive!'));
} 