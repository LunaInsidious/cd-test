import type { Config, VersionTag } from "../config/index.js";
import { calculateNextVersion, getNextTagVersion } from "./calculator.js";

export class VersionManagerError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "VersionManagerError";
	}
}

export class VersionManager {
	constructor(private config: Config) {}

	getAvailableTags(): string[] {
		const tags: string[] = [];
		for (const tagGroup of this.config.versionTags) {
			tags.push(...Object.keys(tagGroup));
		}
		return tags;
	}

	getTagConfig(tag: string): VersionTag[string] | undefined {
		for (const tagGroup of this.config.versionTags) {
			if (tag in tagGroup) {
				return tagGroup[tag];
			}
		}
		return undefined;
	}

	calculateVersionForTag(tag: string, currentVersion?: string): string {
		if (tag === "stable") {
			return calculateNextVersion(
				this.config.baseVersion,
				tag,
				"increment",
				currentVersion,
			);
		}

		const tagConfig = this.getTagConfig(tag);
		if (!tagConfig) {
			throw new VersionManagerError(`Unknown version tag: ${tag}`);
		}

		return calculateNextVersion(
			this.config.baseVersion,
			tag,
			tagConfig.versionSuffixStrategy,
			currentVersion,
		);
	}

	calculateNextTagVersion(currentTag: string, currentVersion?: string): string {
		const tagConfig = this.getTagConfig(currentTag);
		if (!tagConfig) {
			throw new VersionManagerError(`Unknown version tag: ${currentTag}`);
		}

		const nextTag = tagConfig.next;
		if (!nextTag) {
			// If no next tag specified, continue with current tag
			return this.calculateVersionForTag(currentTag, currentVersion);
		}

		return getNextTagVersion(
			this.config.baseVersion,
			currentTag,
			nextTag,
			currentVersion,
		);
	}

	isValidTag(tag: string): boolean {
		return tag === "stable" || this.getTagConfig(tag) !== undefined;
	}

	getTagStrategy(tag: string): "timestamp" | "increment" {
		if (tag === "stable") {
			return "increment";
		}

		const tagConfig = this.getTagConfig(tag);
		if (!tagConfig) {
			throw new VersionManagerError(`Unknown version tag: ${tag}`);
		}

		return tagConfig.versionSuffixStrategy;
	}
}