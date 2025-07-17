import { ensureDir, writeFile } from "../fs/utils.js";
import { askYesNo, askMultipleChoice } from "../interactive/prompts.js";

interface WorkflowTemplate {
	name: string;
	content: string;
}

export async function initCommand(): Promise<void> {
	console.log("🚀 Initializing CD tools configuration...");

	// Check if .cdtools already exists
	try {
		await ensureDir(".cdtools");
		const existingFiles = await import("node:fs/promises").then((fs) =>
			fs.readdir(".cdtools"),
		);
		if (existingFiles.length > 0) {
			const overwrite = await askYesNo(
				".cdtools directory already exists. Overwrite?",
			);
			if (!overwrite) {
				console.log("❌ Initialization cancelled");
				return;
			}
		}
	} catch {
		// Directory doesn't exist, continue
	}

	// Ask user which registries they want to support
	const registryOptions = [
		{ name: "npm (TypeScript/JavaScript)", value: "npm" },
		{ name: "crates.io (Rust)", value: "crates" },
		{ name: "Container Registry (Docker)", value: "container" },
	];

	const selectedRegistries = await askMultipleChoice(
		"Which registries do you want to support?",
		registryOptions,
	);

	// Generate workflows based on selection
	const workflows: WorkflowTemplate[] = [];

	if (selectedRegistries.includes("npm")) {
		workflows.push({
			name: "npm-release",
			content: generateNpmWorkflow(),
		});
	}

	if (selectedRegistries.includes("crates")) {
		workflows.push({
			name: "crates-release",
			content: generateCratesWorkflow(),
		});
	}

	if (selectedRegistries.includes("container")) {
		workflows.push({
			name: "container-release",
			content: generateContainerWorkflow(),
		});
	}

	// Ensure GitHub workflows directory exists
	await ensureDir(".github/workflows");

	// Write workflow files
	for (const workflow of workflows) {
		const filePath = `.github/workflows/${workflow.name}.yml`;
		await writeFile(filePath, workflow.content);
		console.log(`✅ Created ${filePath}`);
	}

	// Generate default configuration
	const defaultConfig = generateDefaultConfig(selectedRegistries);
	await writeFile(
		".cdtools/config.json",
		JSON.stringify(defaultConfig, null, 2),
	);
	console.log("✅ Created .cdtools/config.json");

	console.log("\n🎉 CD tools initialization complete!");
	console.log("Next steps:");
	console.log("1. Edit .cdtools/config.json to match your project structure");
	console.log("2. Run 'cd-tools start-pr' to begin a release");
}

function generateNpmWorkflow(): string {
	return `name: NPM Release

on:
  push:
    paths:
      - '.cdtools/**'
    branches:
      - 'rc:**'
      - main

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build project
        run: npm run build
        
      - name: Run tests
        run: npm test
        
      - name: Determine release info
        id: release-info
        run: |
          if [ -f .cdtools/*_*.json ]; then
            echo "is_rc=true" >> $GITHUB_OUTPUT
            echo "tracking_file=$(ls .cdtools/*_*.json | head -1)" >> $GITHUB_OUTPUT
          else
            echo "is_rc=false" >> $GITHUB_OUTPUT
          fi
          
      - name: Publish to npm (RC)
        if: steps.release-info.outputs.is_rc == 'true'
        run: |
          # Parse tracking file for workspace releases
          tracking_file="\${{ steps.release-info.outputs.tracking_file }}"
          # Implementation would parse JSON and publish only released workspaces
          npm publish --tag rc
        env:
          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}
          
      - name: Publish to npm (Stable)
        if: steps.release-info.outputs.is_rc == 'false' && github.ref == 'refs/heads/main'
        run: npm publish
        env:
          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}
          
      - name: Create GitHub Release
        if: steps.release-info.outputs.is_rc == 'false' && github.ref == 'refs/heads/main'
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: v\${{ steps.version.outputs.version }}
          release_name: Release v\${{ steps.version.outputs.version }}
          draft: false
          prerelease: false
`;
}

function generateCratesWorkflow(): string {
	return `name: Crates.io Release

on:
  push:
    paths:
      - '.cdtools/**'
    branches:
      - 'rc:**'
      - main

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          override: true
          
      - name: Cache cargo registry
        uses: actions/cache@v3
        with:
          path: ~/.cargo/registry
          key: \${{ runner.os }}-cargo-registry-\${{ hashFiles('**/Cargo.lock') }}
          
      - name: Build project
        run: cargo build --release
        
      - name: Run tests
        run: cargo test
        
      - name: Determine release info
        id: release-info
        run: |
          if [ -f .cdtools/*_*.json ]; then
            echo "is_rc=true" >> $GITHUB_OUTPUT
          else
            echo "is_rc=false" >> $GITHUB_OUTPUT
          fi
          
      - name: Publish to crates.io
        if: steps.release-info.outputs.is_rc == 'false' && github.ref == 'refs/heads/main'
        run: cargo publish
        env:
          CARGO_REGISTRY_TOKEN: \${{ secrets.CARGO_REGISTRY_TOKEN }}
`;
}

function generateContainerWorkflow(): string {
	return `name: Container Registry Release

on:
  push:
    paths:
      - '.cdtools/**'
    branches:
      - 'rc:**'
      - main

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        
      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
          
      - name: Determine release info
        id: release-info
        run: |
          if [ -f .cdtools/*_*.json ]; then
            echo "is_rc=true" >> $GITHUB_OUTPUT
            echo "tag_suffix=-rc" >> $GITHUB_OUTPUT
          else
            echo "is_rc=false" >> $GITHUB_OUTPUT
            echo "tag_suffix=" >> $GITHUB_OUTPUT
          fi
          
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ghcr.io/\${{ github.repository }}:latest\${{ steps.release-info.outputs.tag_suffix }}
            ghcr.io/\${{ github.repository }}:\${{ github.sha }}\${{ steps.release-info.outputs.tag_suffix }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
`;
}

function generateDefaultConfig(registries: string[]): object {
	const config = {
		baseVersion: "1.0.0",
		versionTags: [
			{
				alpha: {
					versionSuffixStrategy: "timestamp" as const,
				},
			},
			{
				rc: {
					versionSuffixStrategy: "increment" as const,
					next: "stable",
				},
			},
		],
		projects: [] as Array<{
			path: string;
			type: string;
			registries: string[];
		}>,
		releaseNotes: {
			enabled: true,
			template:
				"## Changes\n\n{{changes}}\n\n## Contributors\n\n{{contributors}}",
		},
	};

	// Add example projects based on selected registries
	if (registries.includes("npm")) {
		config.projects.push({
			path: "./frontend",
			type: "typescript",
			registries: ["npm"],
		});
	}

	if (registries.includes("crates")) {
		config.projects.push({
			path: "./backend",
			type: "rust",
			registries: ["crates"],
		});
	}

	if (registries.includes("container")) {
		config.projects.push({
			path: "./",
			type: "container",
			registries: ["container"],
		});
	}

	// If no specific registries selected, add a generic example
	if (config.projects.length === 0) {
		config.projects.push({
			path: "./",
			type: "typescript",
			registries: ["npm"],
		});
	}

	return config;
}
