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
- **🔗 GitHub Integration**: Direct GitHub CLI integration for PR and release management

## 📋 Prerequisites

### Required Tools

1. **Node.js 20+**
   ```bash
   node --version  # Should be 20.0.0 or higher
   ```

2. **Git**
   ```bash
   git --version
   ```

3. **GitHub CLI (gh)** - **REQUIRED**
   ```bash
   # Install GitHub CLI
   # On macOS
   brew install gh
   
   # On Ubuntu/Debian
   sudo apt install gh
   
   # On Windows
   winget install --id GitHub.cli
   
   # Or download from https://cli.github.com/
   ```

4. **GitHub CLI Authentication** - **REQUIRED**
   ```bash
   # Authenticate with GitHub
   gh auth login
   
   # Verify authentication
   gh auth status
   ```

### Required GitHub Permissions

The GitHub CLI must be authenticated with a token that has the following permissions:

#### Repository Permissions (Required):
- **Contents**: Write ✅ (for creating commits)
- **Metadata**: Read ✅ (for basic repository info)
- **Pull requests**: Write ✅ (for creating/updating/merging PRs)
- **Actions**: Read ✅ (for checking CI status)

#### Optional Permissions (for enhanced features):
- **Administration**: Write (for creating releases)
- **Issues**: Write (for linking issues to PRs)

#### Authentication Setup:
```bash
# Interactive authentication (recommended)
gh auth login

# Or use a personal access token
gh auth login --with-token < token.txt
```

**Personal Access Token Scopes** (if using token authentication):
- `repo` (Full control of private repositories)
- `workflow` (Update GitHub Action workflows)

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

1. **Verify prerequisites:**
   ```bash
   node --version    # Check Node.js
   git --version     # Check Git
   gh --version      # Check GitHub CLI
   gh auth status    # Check GitHub authentication
   ```

2. **Initialize your project:**
   ```bash
   cd-tools init
   ```
   This creates `.cdtools/config.json` and GitHub workflow files.

3. **Configure your project** by editing `.cdtools/config.json`:
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

4. **Start a release:**
   ```bash
   cd-tools start-pr
   ```
   - Select version tag (alpha, rc, etc.)
   - Enter branch name
   - Creates `rc:branch-name` branch
   - Sets up release tracking

5. **Update versions and create PR:**
   ```bash
   cd-tools push-pr
   ```
   - Detects changed files
   - Updates project versions
   - Commits and pushes changes
   - **Automatically creates GitHub PR** ✨

6. **Finalize release:**
   ```bash
   cd-tools end-pr
   ```
   - Applies final version (e.g., rc → stable)
   - **Checks CI status and merges PR** ✨
   - **Creates GitHub release** ✨
   - Cleans up tracking files

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
- **Automatically creates/updates GitHub PR using `gh` CLI**
- Generates detailed PR description with change summary

### `cd-tools end-pr`
**Finalizes the release and merges the PR.**

- Handles version tag transitions (e.g., `rc` → `stable`)
- Updates to final stable versions if configured
- **Checks CI status and PR mergeability**
- **Interactive merge method selection** (squash/merge/rebase)
- **Automatically merges PR using `gh` CLI**
- **Creates GitHub release for stable versions**
- Cleans up tracking files

## 🔧 GitHub CLI Integration

CD Tools integrates directly with GitHub CLI for seamless automation:

### PR Management
- **Automatic PR creation** with detailed descriptions
- **PR status checking** (CI, mergeability)
- **Interactive merge options** with safety checks
- **Automatic PR updates** when pushing new versions

### Release Management
- **Automatic GitHub release creation** for stable versions
- **Release note generation** from project changes
- **Tag creation** with proper versioning

### Error Handling
- **GitHub CLI availability checks** with helpful error messages
- **Authentication verification** before operations
- **Graceful fallbacks** with manual instructions when needed

### Example GitHub Integration Flow:
```bash
cd-tools push-pr
# ✅ GitHub PR created: https://github.com/user/repo/pull/123

cd-tools end-pr
# ✅ CI checks passed
# ✅ PR merged with squash method
# ✅ GitHub release created: https://github.com/user/repo/releases/tag/v1.0.1
```

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
├── git/           # Git and GitHub operations
│   ├── operations.ts # Git commands
│   └── github.ts     # GitHub CLI integration ✨
├── interactive/   # User interaction
│   └── prompts.ts # CLI prompts
└── index.ts       # Main entry point
```

## 🧪 Development

### Prerequisites
- Node.js 20+
- TypeScript 5.8+
- Git
- **GitHub CLI (gh)** - for testing GitHub integration features

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
- GitHub CLI integration (mocked in tests)

### Technology Stack

- **TypeScript** with `@tsconfig/strictest` configuration
- **Zod** for runtime schema validation
- **Vitest** for testing framework
- **Biome** for linting and formatting (unified tool)
- **Node.js ES modules** with ESM-first architecture
- **GitHub CLI** for GitHub integration

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
cd-tools push-pr           # Creates 1.0.1-alpha.20250717123456 + GitHub PR
cd-tools end-pr            # Merge PR and finalize
```

### RC to Stable Flow
```bash
cd-tools start-pr          # Select "rc" tag  
# Make changes...
cd-tools push-pr           # Creates 1.0.1-rc.0 + GitHub PR
cd-tools push-pr           # Creates 1.0.1-rc.1 + Updates PR (if more changes)
cd-tools end-pr            # Creates 1.0.1 stable + Merges PR + GitHub Release
```

### Multi-Project Release
```bash
# Changes to both frontend/ and backend/
cd-tools push-pr           # Updates both package.json and Cargo.toml + Creates PR
# GitHub Actions triggered for both npm and crates.io
cd-tools end-pr            # Merges PR + Creates release
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
7. **Test GitHub CLI integration** (ensure `gh auth status` works)
8. Submit a pull request

### Development Guidelines

- Follow TDD methodology
- Maintain test coverage above 90%
- Use TypeScript strict mode
- Follow existing code patterns
- Update documentation for new features
- Test GitHub CLI integration features

## 🚨 Troubleshooting

### GitHub CLI Issues

**"gh: command not found"**
```bash
# Install GitHub CLI from https://cli.github.com/
# On macOS: brew install gh
# On Ubuntu: sudo apt install gh
# On Windows: winget install --id GitHub.cli
```

**"gh auth status" fails**
```bash
# Authenticate with GitHub
gh auth login
# Follow the interactive prompts
```

**"insufficient permissions" error**
```bash
# Re-authenticate with required scopes
gh auth refresh -s repo,workflow
```

**PR creation fails**
```bash
# Check if you're on the correct branch
git branch --show-current

# Ensure you have commits to create PR from
git log --oneline -5
```

### Common Issues

**"No tracking file found"**
- Run `cd-tools start-pr` first to initialize a release

**"Version tag configuration not found"**
- Check your `.cdtools/config.json` for correct version tag configuration

**"Cannot find module" errors**
- Run `npm run build` to compile TypeScript
- Ensure all dependencies are installed with `npm install`

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
- ✅ **GitHub CLI integration** (PR creation, merging, releases)
- ✅ Interactive prompts system
- ✅ GitHub workflow generation
- ✅ 95+ comprehensive tests
- ✅ TypeScript strict compilation
- ✅ Biome linting/formatting

The tool is **production-ready** for monorepo CD workflows with full GitHub integration via GitHub CLI.