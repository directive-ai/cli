# @directive/cli

A powerful command-line interface for managing AI agents and applications in the Directive ecosystem. This standalone CLI provides secure, authenticated access to Directive Core servers for seamless AI agent orchestration.

## 🚀 Features

- **Secure Authentication**: Login with email/password or API tokens
- **Multi-Environment Support**: Switch between local development and production servers
- **Resource Management**: Create, deploy, and manage AI agents and applications
- **Permission-Based Access**: Granular permissions for different user roles
- **Interactive Commands**: User-friendly prompts and confirmations
- **Configuration Management**: Centralized config with `~/.directive/cli-config.json`

## 🛠️ Quick Start

```bash
# Install globally
npm install -g @directive/cli

# Configure server
directive config set-server http://localhost:3000

# Login
directive login --email admin@directive.com

# Check status
directive whoami

# Start creating
directive create app my-app
directive create agent my-agent --app my-app
directive deploy agent my-agent
```

## 📋 Available Commands

### Authentication
- `directive login` - Authenticate with Directive server
- `directive logout` - Sign out and clear local tokens
- `directive whoami` - Show current user information

### Configuration
- `directive config list` - Display current configuration
- `directive config set-server <url>` - Set server URL
- `directive config set-environment <env>` - Set environment (local/production)

### Resource Management
- `directive create app <name>` - Create new application
- `directive create agent <name>` - Create new AI agent
- `directive list apps` - List all applications
- `directive list agents` - List all agents
- `directive deploy agent <name>` - Deploy agent to server
- `directive status agent <name>` - Check agent status
- `directive delete app <name>` - Remove application
- `directive delete agent <name>` - Remove agent

## 🏗️ Architecture

The CLI communicates with Directive Core servers via REST API, providing a clean separation between client tools and server infrastructure. All operations are authenticated and permission-checked server-side.

```
@directive/cli ←→ REST API ←→ @directive/core
     ↓
~/.directive/cli-config.json
```

## 🔐 Security

- JWT-based authentication with configurable expiration
- Role-based access control (Admin, Developer, User)
- Secure token storage in local configuration
- Permission validation for all operations

## 🌍 Multi-Environment

Easily switch between development and production environments:

```bash
# Local development
directive config set-server http://localhost:3000
directive config set-environment local

# Production
directive config set-server https://api.directive.com
directive config set-environment production
```

## 📖 Documentation

- [Migration Guide](../prd/MIGRATION_CLI_SEPARATION.md) - Complete migration documentation
- [API Extensions](../prd/CORE_API_EXTENSIONS.md) - Required server-side changes
- [Quick Start Guide](../prd/CLI_QUICK_START.md) - Step-by-step setup instructions

## 🧪 Development

```bash
# Clone and setup
git clone <repository>
cd cli/

# Install dependencies
npm install

# Build TypeScript
npm run build

# Link for global development
npm link

# Test the CLI
directive test
```

## 🤝 Contributing

This CLI is part of the larger Directive AI Agents Orchestrator project. Contributions are welcome!

## 📝 License

MIT License - see LICENSE file for details

---

**Part of the Directive AI Agents Orchestrator ecosystem** 🤖✨ 