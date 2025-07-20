#!/bin/bash

# analyze-workspaces.sh
# Analyzes workspaces from branch info files and outputs matrix data for GitHub Actions
#
# Usage: ./analyze-workspaces.sh [npm|docker|all]
#
# Outputs (to GITHUB_OUTPUT if available, otherwise stdout):
#   - npm-matrix: JSON matrix for NPM workspaces
#   - docker-matrix: JSON matrix for Docker workspaces
#   - has-npm: true/false
#   - has-docker: true/false

set -euo pipefail

# Parse arguments
REGISTRY_FILTER="${1:-all}"

# Validate arguments
if [[ ! "$REGISTRY_FILTER" =~ ^(npm|docker|all)$ ]]; then
    echo "❌ Invalid registry filter: $REGISTRY_FILTER" >&2
    echo "Usage: $0 [npm|docker|all]" >&2
    exit 1
fi

# Auto-detect branch info file from current branch
CURRENT_BRANCH=$(git branch --show-current)
BRANCH_INFO_FILE=".cdtools/$(echo "$CURRENT_BRANCH" | sed 's/[^a-zA-Z0-9]/-/g' | sed 's/--*/-/g').json"

# If not found, try to find any branch info file with workspaceUpdated
if [ ! -f "$BRANCH_INFO_FILE" ]; then
    BRANCH_INFO_FILE=$(find .cdtools -name "*-*.json" -exec grep -l "workspaceUpdated" {} \; 2>/dev/null | head -1 || true)
fi

if [ ! -f "$BRANCH_INFO_FILE" ]; then
    echo "❌ Branch info file not found: $BRANCH_INFO_FILE" >&2
    echo "🔍 Available branch info files:" >&2
    ls -la .cdtools/*-*.json 2>/dev/null || echo "  None found" >&2
    exit 1
fi

echo "📋 Using branch info file: $BRANCH_INFO_FILE" >&2

# Load config.json to get registry information
CONFIG_FILE=".cdtools/config.json"
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Config file not found: $CONFIG_FILE" >&2
    exit 1
fi

# Extract workspaces based on registry filter
WORKSPACE_DATA=$(node -e "
    const branchInfo = JSON.parse(require('fs').readFileSync('$BRANCH_INFO_FILE', 'utf-8'));
    const config = JSON.parse(require('fs').readFileSync('$CONFIG_FILE', 'utf-8'));

    if (!branchInfo.workspaceUpdated) {
        console.log(JSON.stringify({ npm: [], docker: [] }));
        process.exit(0);
    }

    const npmWorkspaces = [];
    const dockerWorkspaces = [];

    for (const [workspacePath, version] of Object.entries(branchInfo.workspaceUpdated)) {
        const project = config.projects.find(p => p.path === workspacePath);
        if (!project) continue;

        const workspaceInfo = { workspace_path: workspacePath, workspace_version: version };

        if (project.registries.includes('npm')) {
            npmWorkspaces.push(workspaceInfo);
        }

        if (project.registries.includes('docker')) {
            dockerWorkspaces.push(workspaceInfo);
        }
    }

    console.log(JSON.stringify({
        npm: npmWorkspaces,
        docker: dockerWorkspaces
    }));
")

# Generate matrices based on filter
case "$REGISTRY_FILTER" in
    npm)
        NPM_MATRIX=$(echo "$WORKSPACE_DATA" | node -e "
            const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf-8'));
            console.log(JSON.stringify({ include: data.npm }));
        ")
        HAS_NPM=$(echo "$WORKSPACE_DATA" | node -e "
            const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf-8'));
            console.log(data.npm.length > 0 ? 'true' : 'false');
        ")

        # Output results
        if [ -n "${GITHUB_OUTPUT:-}" ]; then
            echo "npm-matrix=$NPM_MATRIX" >> "$GITHUB_OUTPUT"
            echo "has-npm=$HAS_NPM" >> "$GITHUB_OUTPUT"
        else
            echo "npm-matrix=$NPM_MATRIX"
            echo "has-npm=$HAS_NPM"
        fi

        echo "🔍 Analysis complete:" >&2
        echo "  NPM workspaces: $HAS_NPM" >&2
        echo "  NPM matrix: $NPM_MATRIX" >&2
        ;;

    docker)
        DOCKER_MATRIX=$(echo "$WORKSPACE_DATA" | node -e "
            const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf-8'));
            console.log(JSON.stringify({ include: data.docker }));
        ")
        HAS_DOCKER=$(echo "$WORKSPACE_DATA" | node -e "
            const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf-8'));
            console.log(data.docker.length > 0 ? 'true' : 'false');
        ")

        # Output results
        if [ -n "${GITHUB_OUTPUT:-}" ]; then
            echo "docker-matrix=$DOCKER_MATRIX" >> "$GITHUB_OUTPUT"
            echo "has-docker=$HAS_DOCKER" >> "$GITHUB_OUTPUT"
        else
            echo "docker-matrix=$DOCKER_MATRIX"
            echo "has-docker=$HAS_DOCKER"
        fi

        echo "🔍 Analysis complete:" >&2
        echo "  Docker workspaces: $HAS_DOCKER" >&2
        echo "  Docker matrix: $DOCKER_MATRIX" >&2
        ;;

    all)
        NPM_MATRIX=$(echo "$WORKSPACE_DATA" | node -e "
            const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf-8'));
            console.log(JSON.stringify({ include: data.npm }));
        ")
        DOCKER_MATRIX=$(echo "$WORKSPACE_DATA" | node -e "
            const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf-8'));
            console.log(JSON.stringify({ include: data.docker }));
        ")
        HAS_NPM=$(echo "$WORKSPACE_DATA" | node -e "
            const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf-8'));
            console.log(data.npm.length > 0 ? 'true' : 'false');
        ")
        HAS_DOCKER=$(echo "$WORKSPACE_DATA" | node -e "
            const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf-8'));
            console.log(data.docker.length > 0 ? 'true' : 'false');
        ")

        # Output results
        if [ -n "${GITHUB_OUTPUT:-}" ]; then
            echo "npm-matrix=$NPM_MATRIX" >> "$GITHUB_OUTPUT"
            echo "docker-matrix=$DOCKER_MATRIX" >> "$GITHUB_OUTPUT"
            echo "has-npm=$HAS_NPM" >> "$GITHUB_OUTPUT"
            echo "has-docker=$HAS_DOCKER" >> "$GITHUB_OUTPUT"
        else
            echo "npm-matrix=$NPM_MATRIX"
            echo "docker-matrix=$DOCKER_MATRIX"
            echo "has-npm=$HAS_NPM"
            echo "has-docker=$HAS_DOCKER"
        fi

        echo "🔍 Analysis complete:" >&2
        echo "  NPM workspaces: $HAS_NPM" >&2
        echo "  Docker workspaces: $HAS_DOCKER" >&2
        echo "  NPM matrix: $NPM_MATRIX" >&2
        echo "  Docker matrix: $DOCKER_MATRIX" >&2
        ;;
esac
