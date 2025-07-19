# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build
```bash
npm run build
```
- Compiles TypeScript to JavaScript in `dist/` directory
- Runs lint and format checks as prebuild steps
- Uses strict TypeScript configuration from `@tsconfig/strictest`

### Testing
```bash
npm test           # Run all tests once
npm run test:watch # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```
- Uses Vitest as the test runner
- Test files should be named `*.test.ts` and placed in `src/tests/` or alongside source files
- Coverage reports generated in HTML, JSON, and text formats

### Linting and Formatting
```bash
npm run lint       # Check for linting issues
npm run format     # Auto-format code
```
- Uses Biome for both linting and formatting
- Configured to use tabs for indentation and double quotes
- Test files have relaxed rules (non-null assertions allowed)

## Architecture

This is a TypeScript project designed to be a CD (Continuous Deployment) tool for monorepo management. The project structure is:

- `src/index.ts` - Main entry point (currently minimal)
- `src/tests/` - Test directory
- `docs/design.md` - Detailed design document in Japanese outlining the tool's requirements

### Key Design Goals (from design.md)
The tool aims to provide:
1. **Version Calculation** - Support for user-defined version tags with automatic release notes
2. **Version Application** - Update build versions across different languages
3. **Version Release** - Deploy to various registries including container registries
4. **Monorepo Support** - Handle multiple projects with different languages in a single repository

### Configuration Structure
The tool will use `.cdtools/config.json` for configuration, supporting:
- Base version management
- User-defined version tags with flexible strategies (timestamp or increment)
- Multi-language project definitions (TypeScript, Rust, etc.)
- Registry configurations (npm, crates.io, container registries)
- Release note templates

### Workflow Commands (Planned)
- `cd-tools init` - Initialize project with GitHub workflows
- `cd-tools start-pr` - Start a release PR with version selection
- `cd-tools push-pr` - Update versions and create/update PR
- `cd-tools end-pr` - Finalize release and merge PR

## Dependencies

### Library Installation Policy
**IMPORTANT**: When adding new libraries, follow this process:
1. Consult with gemini cli to discuss complexity and reliability benefits
2. Only proceed with installation if both parties reach mutual agreement
3. Document the decision in `docs/ADR.md` with rationale and alternatives considered

### Current Dependencies
- **Runtime**: `zod` for schema validation
- **Dev**: Biome (linting/formatting), Vitest (testing), TypeScript with strict configuration

## Architecture Decision Records
All significant architectural decisions, including library additions, are documented in `docs/ADR.md`.

## Project-Specific Requirements

### Directory Structure
- Configuration and tracking files: `/.cdtools` (no hyphen)
- Branch info files: Use hyphens (e.g., `rc-feat-hoge.json`)
- Other files: Use camelCase (e.g., `config.json`)

### Versioning Strategy
- **fixed**: All workspaces use the same version (follows updates even without changes)
- **independent**: Only changed workspaces and their dependents are versioned

### Version Suffix Format
- Timestamp format: `YYYYMMDDhhmmss`
- Increment format: `[tag].0`, `[tag].1`, etc.

### Dependencies Management
- `deps` field: List of file paths (not just package.json) that trigger workspace updates
- Includes Dockerfiles, configuration files, etc.

### Bump Tracking
- `bumpedVersions`: Tracks version bump types (patch/minor/major) within a release cycle
- Cleared on stable release

### Error Handling
- Missing GitHub CLI: Show `gh auth status` output + "Github CLI でログインできていないようです。"
- Network errors: Display error message as-is (no retry)

### UI Library
- Use `prompts` library (not `enquirer` or `readline`)
