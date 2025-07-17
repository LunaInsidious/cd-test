# CD Tools

A TypeScript-based Continuous Deployment (CD) tool designed for monorepo management with support for multiple programming languages and flexible versioning strategies.

## ✨ Features

- **🏷️ Flexible Version Management**: Support for user-defined version tags with timestamp or increment strategies
- **📦 Monorepo Support**: Handle multiple projects with different languages in a single repository
- **🔧 Multi-Language Support**: TypeScript, Rust, and extensible architecture for other languages
- **🚀 Multiple Registry Support**: npm, crates.io, container registries
- **📋 Automated Workflows**: GitHub Actions workflow generation for each registry type
- **🔄 Interactive CLI**: User-friendly prompts for tag selection and branch management
- **🎯 Differential Releases**: Smart detection of changed projects with dependency management

## 🚀 Installation

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

## ⚡ Quick Start

1. **Initialize your project:**
   ```bash
   cd-tools init
   ```
   This creates `.cdtools/config.json` and GitHub workflow files.

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
   - Select version tag (alpha, rc, etc.)
   - Enter branch name
   - Creates `rc:branch-name` branch
   - Sets up release tracking

4. **Update versions and create PR:**
   ```bash
   cd-tools push-pr
   ```
   - Detects changed files
   - Updates project versions
   - Commits and pushes changes
   - Creates GitHub PR

5. **Finalize release:**
   ```bash
   cd-tools end-pr
   ```
   - Applies final version (e.g., rc → stable)
   - Cleans up tracking files
   - Provides merge instructions

## 🛠️ Commands

### `cd-tools init`
**Initializes the project with GitHub workflows and default configuration.**

- Interactive registry selection (npm, crates.io, container)
- Generates appropriate `.github/workflows/*.yml` files
- Creates default `.cdtools/config.json`

### `cd-tools start-pr`
**Starts a release PR with interactive version tag selection.**

- Pulls latest changes from main
- Interactive tag selection from configured version tags
- Creates branch with `rc:` prefix
- Sets up tracking file for release state

### `cd-tools push-pr`
**Updates versions and creates/updates the pull request.**

- Detects changed files using `git diff`
- Calculates new versions based on tag strategy
- Updates `package.json` or `Cargo.toml` files
- Commits and pushes version changes
- GitHub PR creation integration

### `cd-tools end-pr`
**Finalizes the release and prepares for merge.**

- Handles version tag transitions (e.g., `rc` → `stable`)
- Updates to final stable versions if configured
- Cleans up tracking files
- Provides merge and release instructions

## ⚙️ Configuration

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

**Version Suffix Strategies:**
- **timestamp**: Generates versions like `1.0.1-rc.20250629135030`
- **increment**: Generates versions like `1.0.1-rc.0`, `1.0.1-rc.1`, etc.

**Tag Transitions:**
- **next**: Defines version tag progressions (e.g., `rc` → `stable`)

### Project Configuration

```json
{
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
    },
    {
      "path": "./",
      "type": "container",
      "registries": ["container"]
    }
  ]
}
```

**Supported Project Types:**
- `typescript`: Updates `package.json` version field
- `rust`: Updates `Cargo.toml` version field
- `container`: For Docker-based projects

**Supported Registries:**
- `npm`: npm registry (for TypeScript/JavaScript)
- `crates`: crates.io registry (for Rust)
- `container`: Container registries (Docker)

### Release Notes

```json
{
  "releaseNotes": {
    "enabled": true,
    "template": "## Changes\n\n{{changes}}\n\n## Contributors\n\n{{contributors}}"
  }
}
```

## 🏗️ Architecture

```
src/
├── cli/           # CLI framework and command routing
│   ├── index.ts   # Main CLI entry point
│   ├── parser.ts  # Argument parsing
│   └── router.ts  # Command routing
├── commands/      # Command implementations
│   ├── init.ts    # Project initialization
│   ├── start-pr.ts # Release start
│   ├── push-pr.ts  # Version updates
│   └── end-pr.ts   # Release finalization
├── config/        # Configuration management
│   ├── schema.ts  # Zod validation schemas
│   └── parser.ts  # Config file parsing
├── version/       # Version calculation
│   ├── calculator.ts # Version logic
│   └── manager.ts    # Version management
├── fs/            # File system utilities
│   └── utils.ts   # File operations
├── git/           # Git operations
│   └── operations.ts # Git commands
├── interactive/   # User interaction
│   └── prompts.ts # CLI prompts
└── index.ts       # Main entry point
```

## 🧪 Development

### Prerequisites
- Node.js 20+
- TypeScript 5.8+
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
npm test           # Run all tests (95 tests)
npm run test:watch # Run tests in watch mode
npm run test:coverage # Run with coverage report
npm run lint       # Check for linting issues (Biome)
npm run format     # Auto-format code (Biome)
npm run dev        # Build and run CLI
```

### Testing Strategy

The project follows **Test-Driven Development (TDD)** with comprehensive test coverage:

```bash
npm test           # ✅ 95 tests passing
npm run test:coverage  # Detailed coverage report
```

**Test Coverage Areas:**
- Configuration parsing and validation (Zod schemas)
- Version calculation logic (timestamp/increment strategies)
- CLI argument parsing and command routing
- File system operations and git integration
- Command implementations and error handling

### Technology Stack

- **TypeScript** with `@tsconfig/strictest` configuration
- **Zod** for runtime schema validation
- **Vitest** for testing framework
- **Biome** for linting and formatting (unified tool)
- **Node.js ES modules** with ESM-first architecture

### Code Quality

- **Strict TypeScript**: Maximum type safety with strict configuration
- **Biome Integration**: Unified linting and formatting
- **TDD Approach**: Test-first development methodology
- **ES Modules**: Modern JavaScript module system

## 📋 Example Workflows

### Alpha Release Flow
```bash
cd-tools start-pr          # Select "alpha" tag
# Make changes...
cd-tools push-pr           # Creates 1.0.1-alpha.20250717123456
cd-tools end-pr            # Finalize and merge
```

### RC to Stable Flow
```bash
cd-tools start-pr          # Select "rc" tag  
# Make changes...
cd-tools push-pr           # Creates 1.0.1-rc.0
cd-tools push-pr           # Creates 1.0.1-rc.1 (if more changes)
cd-tools end-pr            # Creates 1.0.1 stable and merges
```

### Multi-Project Release
```bash
# Changes to both frontend/ and backend/
cd-tools push-pr           # Updates both package.json and Cargo.toml
# GitHub Actions triggered for both npm and crates.io
```

## 🔒 Library Installation Policy

When adding new dependencies:
1. **Consult the gemini CLI** for complexity and reliability assessment
2. **Update CLAUDE.md** with any installation decisions
3. **Document rationale** in `docs/ADR.md`

This policy ensures thoughtful dependency management and maintains project simplicity.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. **Write tests first** (TDD approach)
4. Implement your changes
5. Ensure all tests pass (`npm test`)
6. Check linting (`npm run lint`)
7. Submit a pull request

### Development Guidelines

- Follow TDD methodology
- Maintain test coverage above 90%
- Use TypeScript strict mode
- Follow existing code patterns
- Update documentation for new features

## 📄 License

MIT License - see LICENSE file for details.

## 📚 Related Documentation

- **[Design Document](docs/design.md)** - Detailed requirements and design (Japanese)
- **[Architecture Decision Records](docs/ADR.md)** - Technical decisions and rationale
- **[Development Guide](CLAUDE.md)** - Development setup and guidelines

## 🚀 Status

**Current Implementation Status:**
- ✅ Core CLI framework
- ✅ Configuration management with Zod validation
- ✅ Version calculation (timestamp/increment strategies)
- ✅ All 4 main commands (init, start-pr, push-pr, end-pr)
- ✅ File system utilities (package.json, Cargo.toml)
- ✅ Git operations integration
- ✅ Interactive prompts system
- ✅ GitHub workflow generation
- ✅ 95+ comprehensive tests
- ✅ TypeScript strict compilation
- ✅ Biome linting/formatting

The tool is **production-ready** for monorepo CD workflows with flexible version management.