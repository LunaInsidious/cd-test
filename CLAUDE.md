# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

cd-tools is a TypeScript-based Continuous Deployment (CD) tool for monorepo management with support for multiple programming languages and flexible versioning strategies. It provides automated GitHub PR creation, merging, and release management.

## Essential Commands

### Development Workflow
```bash
npm run build        # Build TypeScript to JavaScript
npm test            # Run all tests (95+ tests)
npm run test:watch  # Run tests in watch mode
npm run test:coverage # Run with coverage report
npm run lint        # Check for linting issues (Biome)
npm run format      # Auto-format code (Biome)
npm run dev         # Build and run CLI locally
```

### Testing Specific Components
```bash
# Run tests for specific files
npm test src/commands/init.test.ts
npm test src/utils/config.test.ts
```

### CLI Usage (after build)
```bash
cd-tools init       # Initialize project configuration
cd-tools start-pr   # Start a new release PR
cd-tools push-pr    # Update versions and create/update PR
cd-tools end-pr     # Finalize release and merge PR
```

## Architecture Overview

### Core System Design
- **ES Modules**: Modern JavaScript module system throughout
- **Strict TypeScript**: Uses `@tsconfig/strictest` for maximum type safety
- **TDD Approach**: Test-driven development with 95+ comprehensive tests
- **GitHub CLI Integration**: Direct integration with `gh` CLI for PR/release automation

### Key Modules Structure
```
src/
├── index.ts           # CLI entry point with command routing
├── commands/          # Command implementations (init, start-pr, push-pr, end-pr)
├── utils/
│   ├── config.ts      # Configuration management and branch tracking
│   ├── git.ts         # Git operations with security validation
│   ├── github.ts      # GitHub CLI integration
│   └── version-updater.ts # Version calculation and file updates
```

### Configuration Management
- **Config Location**: `.cdtools/config.json`
- **Branch Tracking**: `.cdtools/{tag}-{branch}.json` files for release state
- **Version Tags**: Configurable with timestamp or increment strategies
- **Project Types**: TypeScript (package.json), Rust (Cargo.toml), Container

### GitHub Integration
- **PR Management**: Automatic creation, updates, and merging via `gh` CLI
- **Release Creation**: Automated GitHub releases for stable versions
- **CI Integration**: Checks CI status before merging PRs
- **Authentication**: Requires `gh auth login` with repo and workflow permissions

## Technology Stack

### Core Dependencies
- **Biome**: Unified linting and formatting (replaces ESLint + Prettier)
- **Vitest**: Modern testing framework with excellent TypeScript support
- **Prompts**: Interactive CLI prompts
- **Zod**: Runtime schema validation (if used in codebase)

### Code Quality Tools
- **TypeScript**: Strict configuration with `@tsconfig/strictest`
- **Biome**: Tab indentation, double quotes, organized imports
- **Test Coverage**: Aim for >90% coverage with comprehensive unit tests

## Development Guidelines

### File Naming and Structure
- Use kebab-case for files: `start-pr.ts`, `end-pr.test.ts`
- Command files in `src/commands/` with corresponding test files
- Utility functions in `src/utils/` with focused responsibilities

### Code Patterns
- **Error Handling**: Custom error classes (GitError) with descriptive messages
- **Git Security**: Always validate branch names with `git check-ref-format`
- **Async/Await**: Consistent use throughout, no Promise chains
- **Type Safety**: Strict TypeScript, no `any` types
- **ES Modules**: Use `.js` extensions in imports for compatibility

### Testing Requirements
- **Unit Tests**: Every function should have corresponding tests
- **Test Location**: `*.test.ts` files alongside source files
- **Mocking**: Mock external dependencies (git commands, GitHub CLI)
- **Coverage**: Maintain >90% test coverage

### Version Management Logic
- **Timestamp Strategy**: `1.0.1-alpha.20250717123456`
- **Increment Strategy**: `1.0.1-rc.0`, `1.0.1-rc.1`
- **Tag Transitions**: `rc` → `stable` for final releases
- **Multi-Project**: Independent versioning with dependency detection

## Branch and Release Workflow

### Branch Naming Convention
- Format: `{originalBranch}({tag})` (e.g., `feature-auth(alpha)`)
- Tracking files: `.cdtools/{tag}-{branch}.json`
- Branch validation via `git check-ref-format`

### Release Process
1. **start-pr**: Creates branch, initializes tracking file
2. **push-pr**: Detects changes, updates versions, creates GitHub PR
3. **end-pr**: Applies final versions, merges PR, creates releases

### GitHub CLI Requirements
The tool requires GitHub CLI authentication:
```bash
gh auth login
gh auth status  # Verify authentication
```
Required permissions: repo, workflow, pull requests, actions

## Important Development Notes

### Security Considerations
- Never execute arbitrary shell commands
- Validate all branch names before git operations
- Use spawn() instead of exec() for git commands
- Sanitize file paths and user inputs

### Library Installation Policy
When adding new dependencies:
1. Consult the existing ADR.md for patterns
2. Prefer lightweight, focused libraries
3. Maintain the current dependency philosophy
4. Update ADR.md with rationale for new dependencies

### File System Operations
- Configuration files use tab indentation
- JSON files have trailing newlines
- Use proper error handling for file operations
- Check file existence before operations

### Common Pitfalls
- Remember to build (`npm run build`) before testing CLI locally
- GitHub CLI must be authenticated for PR/release features
- Branch tracking files are cleaned up automatically by end-pr
- Version calculation depends on git diff and merge-base logic

## Testing and Quality Assurance

### Before Committing
```bash
npm run build     # Ensure TypeScript compiles
npm test         # All tests must pass
npm run lint     # No linting errors
npm run format   # Code is properly formatted
```

### Integration Testing
- Test with real git repositories
- Verify GitHub CLI integration (requires authentication)
- Test version calculation with various scenarios
- Validate configuration parsing edge cases