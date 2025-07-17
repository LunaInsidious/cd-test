# CD Tools

A TypeScript-based Continuous Deployment (CD) tool designed for monorepo management with support for multiple programming languages and flexible versioning strategies.

## Features

- **Flexible Version Management**: Support for user-defined version tags with timestamp or increment strategies
- **Monorepo Support**: Handle multiple projects with different languages in a single repository
- **Multi-Language Support**: TypeScript, Rust, and extensible for other languages
- **Multiple Registry Support**: npm, crates.io, container registries
- **Automated Release Notes**: Template-based release note generation
- **GitHub Integration**: Automated workflow generation and PR management

## Installation

```bash
npm install -g cd-tools
```

Or for development:

```bash
git clone <repository>
cd cd-tools
npm install
npm run build
```

## Quick Start

1. **Initialize your project:**
   ```bash
   cd-tools init
   ```

2. **Configure your project** by editing `.cdtools/config.json`:
   ```json
   {
     "baseVersion": "1.0.0",
     "versionTags": [
       {
         "alpha": {
           "versionSuffixStrategy": "timestamp"
         }
       },
       {
         "rc": {
           "versionSuffixStrategy": "increment",
           "next": "stable"
         }
       }
     ],
     "projects": [
       {
         "path": "./frontend",
         "type": "typescript",
         "registries": ["npm"]
       },
       {
         "path": "./backend",
         "type": "rust",
         "registries": ["crates"]
       }
     ],
     "releaseNotes": {
       "enabled": true,
       "template": "## Changes\n\n{{changes}}\n\n## Contributors\n\n{{contributors}}"
     }
   }
   ```

3. **Start a release:**
   ```bash
   cd-tools start-pr
   ```

4. **Update versions and create PR:**
   ```bash
   cd-tools push-pr
   ```

5. **Finalize release:**
   ```bash
   cd-tools end-pr
   ```

## Commands

### `cd-tools init`
Initializes the project with GitHub workflows and default configuration.

### `cd-tools start-pr`
Starts a release PR with interactive version tag selection. Creates a new branch and sets up release tracking.

### `cd-tools push-pr`
Updates version fields across projects and creates/updates the pull request. Handles differential releases based on changed files.

### `cd-tools end-pr`
Finalizes the release by applying final version updates, triggering releases, and merging the PR.

## Configuration

The tool uses `.cdtools/config.json` for configuration:

### Version Tags

Define custom version tags with flexible strategies:

```json
{
  "versionTags": [
    {
      "dev": {
        "versionSuffixStrategy": "timestamp"
      }
    },
    {
      "rc": {
        "versionSuffixStrategy": "increment",
        "next": "stable"
      }
    }
  ]
}
```

- **timestamp**: Generates versions like `1.0.1-rc.20250629135030`
- **increment**: Generates versions like `1.0.1-rc.0`, `1.0.1-rc.1`, etc.
- **next**: Defines version tag transitions (e.g., `rc` → `stable`)

### Project Types

Supported project types:
- `typescript`: For TypeScript/JavaScript projects
- `rust`: For Rust projects

### Registries

Supported registries:
- `npm`: npm registry
- `crates`: crates.io registry  
- `docker`: Container registries

## Version Strategies

### Timestamp Strategy
```
1.0.1-alpha.20250629135030
```
Perfect for development builds where you want unique, time-based versions.

### Increment Strategy
```
1.0.1-rc.0 → 1.0.1-rc.1 → 1.0.1-rc.2
```
Ideal for release candidates where you want sequential numbering.

### Tag Transitions
Configure version progressions:
```
dev → alpha → rc → stable
```

## Development

### Prerequisites
- Node.js 18+
- TypeScript
- Git

### Setup
```bash
git clone <repository>
cd cd-tools
npm install
```

### Available Scripts
```bash
npm run build       # Build TypeScript to JavaScript
npm test           # Run all tests
npm run test:watch # Run tests in watch mode
npm run lint       # Check for linting issues
npm run format     # Auto-format code
npm run dev        # Build and run CLI
```

### Testing
The project follows Test-Driven Development (TDD) with comprehensive test coverage:

```bash
npm test           # Run all tests
npm run test:coverage  # Run with coverage report
```

Current test coverage: 95+ tests across:
- Configuration parsing and validation
- Version calculation logic
- CLI argument parsing and routing

### Architecture

```
src/
├── cli/           # CLI framework and command routing
├── config/        # Configuration schema and parsing
├── version/       # Version calculation and management
└── index.ts       # Main entry point
```

## Library Installation Policy

When adding new dependencies:
1. Consult with the team to discuss complexity and reliability benefits
2. Only proceed if there's mutual agreement
3. Document the decision in `docs/ADR.md`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for your changes
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Related Documentation

- [Design Document](docs/design.md) - Detailed requirements and design (Japanese)
- [Architecture Decision Records](docs/ADR.md) - Technical decisions and rationale
- [Development Guide](CLAUDE.md) - Development setup and guidelines