# @directive/cli

CLI pour Directive - AI Agents Orchestrator

## Installation

```bash
npm install -g @directive/cli
```

## Configuration

La CLI communique avec le serveur Directive Core via son API REST. Vous devez d'abord vous authentifier :

```bash
directive login
```

## Commandes disponibles

### Authentification
- `directive login` - S'authentifier auprès du serveur Directive
- `directive logout` - Se déconnecter
- `directive whoami` - Afficher l'utilisateur connecté

### Gestion des applications
- `directive create app <name>` - Créer une nouvelle application
- `directive list apps` - Lister les applications
- `directive delete app <name>` - Supprimer une application

### Gestion des agents
- `directive create agent <name>` - Créer un nouvel agent
- `directive list agents` - Lister les agents
- `directive deploy agent <name>` - Déployer un agent
- `directive delete agent <name>` - Supprimer un agent
- `directive status agent <name>` - Afficher le statut d'un agent

### Configuration
- `directive config list` - Afficher la configuration
- `directive config set-server <url>` - Configurer l'URL du serveur

## Configuration

La CLI stocke sa configuration dans `~/.directive/cli-config.json` :

```json
{
  "serverUrl": "http://localhost:3000",
  "authToken": "...",
  "user": {
    "id": "...",
    "name": "..."
  }
}
``` 