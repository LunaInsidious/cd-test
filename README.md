# CD Tools

A TypeScript-based Continuous Deployment (CD) tool designed for monorepo
management with flexible versioning strategies and GitHub integration.

## ✨ Features

- **🏷️ Flexible Version Management**: Support for user-defined version tags with
  timestamp or increment strategies
- **📦 Monorepo Support**: Handle multiple projects with different languages in
  a single repository
- **🔧 Multi-Language Support**: TypeScript/npm and Rust/crates.io with
  extensible architecture
- **🚀 Registry Support**: npm, crates.io, and container registries
- **📋 Automated Workflows**: GitHub Actions workflow generation for each
  registry type
- **🔄 Interactive CLI**: User-friendly prompts for version bumps and tag
  selection
- **🎯 Smart Change Detection**: Automatic detection of changed projects with
  dependency tracking
- **🔗 GitHub Integration**: Direct GitHub CLI integration for PR and release
  management

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

The GitHub CLI must be authenticated with a token that has the following
permissions:

#### Repository Permissions (Required):

- **Contents**: Write ✅ (for creating commits)
- **Metadata**: Read ✅ (for basic repository info)
- **Pull requests**: Write ✅ (for creating/updating/merging PRs)

#### Personal Access Token Scopes (if using token authentication):

- `repo` (Full control of private repositories)

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
     "versioningStrategy": "fixed",
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
         "baseVersion": "1.0.0",
         "deps": ["./backend", "package.json"],
         "registries": ["npm"]
       },
       {
         "path": "./backend",
         "type": "rust",
         "baseVersion": "1.1.0",
         "registries": ["crates"]
       }
     ]
   }
   ```

4. **Start a release:**
   ```bash
   cd-tools start-pr
   ```
   - Select version tag (alpha, rc, stable)
   - Enter branch name
   - Creates `branchName(tag)` branch
   - Sets up release tracking

5. **Update versions and create PR:**
   ```bash
   cd-tools push-pr
   ```
   - Select bump types (patch/minor/major) for each project
   - Detects changed files automatically
   - Updates project versions intelligently
   - Commits and pushes changes
   - **Automatically creates GitHub PR** ✨

6. **Finalize release:**
   ```bash
   cd-tools end-pr
   ```
   - Applies next version if configured (e.g., rc → stable)
   - **Automatically merges PR with squash** ✨
   - Cleans up tracking files

## 🛠️ Commands

### `cd-tools init`

**Initializes the project with GitHub workflows and default configuration.**

- Interactive registry selection (npm, docker)
- Generates appropriate `.github/workflows/*.yml` files
- Creates default `.cdtools/config.json`
- Sets up `analyze-workspaces.sh` script

### `cd-tools start-pr`

**Starts a release PR with interactive version tag selection.**

- Pulls latest changes from current branch
- Interactive tag selection from configured version tags
- Creates branch with format: `branchName(tag)`
- Sets up tracking file for release state

### `cd-tools push-pr`

**Updates versions and creates/updates the pull request.**

- Interactive bump type selection (patch/minor/major) per project
- Detects changed files using `git diff`
- Calculates new versions based on tag strategy and existing bumps
- Updates `package.json` or `Cargo.toml` files
- Commits and pushes version changes
- **Automatically creates/updates GitHub PR using `gh` CLI**
- Generates detailed PR description with change summary

### `cd-tools end-pr`

**Finalizes the release and merges the PR.**

- Handles version tag transitions (e.g., `rc` → `stable`)
- Updates to next tag versions if configured
- Updates base versions for stable releases
- **Automatically merges PR using `gh` CLI with squash method**
- Cleans up tracking files
- Deletes release branch

## 🔧 GitHub CLI Integration

CD Tools integrates directly with GitHub CLI for seamless automation:

### PR Management

- **Automatic PR creation** with detailed descriptions
- **Interactive base branch selection** with safety checks
- **Automatic PR merging** with squash method
- **Automatic branch cleanup** after merge

### Error Handling

- **GitHub CLI availability checks** with helpful error messages
- **Authentication verification** before operations
- **Graceful error handling** with clear instructions

### Example GitHub Integration Flow:

```bash
npx cd-tools push-pr
# ✅ GitHub PR created: https://github.com/user/repo/pull/123

npx cd-tools end-pr
# ✅ PR merged with squash method
# ✅ Branch deleted
```

## ⚙️ Configuration

The tool uses `.cdtools/config.json` for configuration:

### Versioning Strategies

- **`fixed`**: All projects use the same version (follows updates even without
  changes)
- **`independent`**: Only changed projects and their dependents are versioned

### Version Tags

Define custom version tags with flexible strategies:

```json
{
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
      "baseVersion": "1.0.0",
      "deps": ["./backend", "package.json"],
      "registries": ["npm"]
    },
    {
      "path": "./backend",
      "type": "rust",
      "baseVersion": "1.1.0",
      "registries": ["crates"]
    }
  ]
}
```

**Supported Project Types:**

- `typescript`: Updates `package.json` version field
- `rust`: Updates `Cargo.toml` version field

**Supported Registries:**

- `npm`: npm registry (for TypeScript/JavaScript)
- `crates`: crates.io registry (for Rust)
- `docker`: Container registries (Docker)

**Dependencies (deps):**

- List of file paths (not just package.json) that trigger workspace updates
- Includes Dockerfiles, configuration files, etc.

## 🏗️ Architecture

```
src/
├── index.ts           # Main CLI entry point with command routing
├── commands/          # Command implementations
│   ├── init.ts        # Project initialization with GitHub workflows
│   ├── start-pr.ts    # Release branch creation
│   ├── push-pr.ts     # Version updates and PR creation
│   └── end-pr.ts      # Release finalization and PR merge
└── utils/             # Core utilities
    ├── config.ts      # Configuration and branch info management
    ├── git.ts         # Git operations with security validation
    ├── github.ts      # GitHub CLI integration
    └── version-updater.ts # Version file updates
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
npm test           # Run all tests (78 tests)
npm run test:watch # Run tests in watch mode
npm run test:coverage # Run with coverage report
npm run lint       # Check for linting issues (Biome)
npm run format     # Auto-format code (Biome)
npm run dev        # Build and run CLI
```

### Testing Strategy

The project follows **Test-Driven Development (TDD)** with comprehensive test
coverage:

```bash
npm test           # ✅ 78 tests passing
npm run test:coverage  # Detailed coverage report
```

**Test Coverage Areas:**

- Configuration parsing and validation
- Version calculation logic (timestamp/increment strategies)
- CLI argument parsing and command routing
- File system operations and git integration
- Command implementations and error handling
- GitHub CLI integration (mocked in tests)

### Technology Stack

- **TypeScript** with `@tsconfig/strictest` configuration
- **Prompts** for interactive CLI
- **Vitest** for testing framework
- **Biome** for linting and formatting (unified tool)
- **Node.js ES modules** with ESM-first architecture
- **GitHub CLI** for GitHub integration

### Code Quality

- **Strict TypeScript**: Maximum type safety with strict configuration
- **Biome Integration**: Unified linting and formatting
- **TDD Approach**: Test-first development methodology
- **ES Modules**: Modern JavaScript module system
- **Security**: Secure subprocess execution with `spawn`

## 📋 Example Workflows

### Alpha Release Flow

```bash
cd-tools start-pr          # Select "alpha" tag, create branch
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
cd-tools end-pr            # Creates 1.0.1 stable + Merges PR
```

### Multi-Project Release

```bash
# Changes to both frontend/ and backend/
cd-tools push-pr           # Updates both package.json and Cargo.toml + Creates PR
# GitHub Actions triggered for both npm and crates.io
cd-tools end-pr            # Merges PR
```

### Fixed vs Independent Strategy

**Fixed Strategy:**

- All projects get the same version
- If any project changes, all projects are updated

**Independent Strategy:**

- Only changed projects get new versions
- Dependencies are automatically detected and updated

## 🔒 Library Installation Policy

When adding new dependencies:

1. **Consult the gemini CLI** for complexity and reliability assessment
2. **Update CLAUDE.md** with any installation decisions
3. **Document rationale** in `docs/ADR.md`

This policy ensures thoughtful dependency management and maintains project
simplicity.

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
gh auth refresh -s repo
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

**"Branch info file not found"**

- Run `cd-tools start-pr` to create the tracking file
- Check that you're on the correct release branch

## 📄 License

MIT License - see LICENSE file for details.

## 📚 Related Documentation

- **[Design Document](docs/design.md)** - Detailed requirements and design
  (Japanese)
- **[Development Guide](CLAUDE.md)** - Development setup and guidelines

## 🚀 Status

**Current Implementation Status:**

- ✅ Core CLI framework with command routing
- ✅ Configuration management with validation
- ✅ Version calculation (timestamp/increment strategies)
- ✅ All 4 main commands (init, start-pr, push-pr, end-pr)
- ✅ File system utilities (package.json, Cargo.toml)
- ✅ Git operations with security validation
- ✅ **GitHub CLI integration** (PR creation, merging)
- ✅ Interactive prompts system
- ✅ GitHub workflow generation
- ✅ **78 comprehensive tests** with full coverage
- ✅ TypeScript strict compilation
- ✅ Biome linting/formatting
- ✅ **Branch info tag updates** for next version transitions

The tool is **production-ready** for monorepo CD workflows with full GitHub
integration via GitHub CLI.
