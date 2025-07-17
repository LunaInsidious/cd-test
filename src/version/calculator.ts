import type { VersionSuffixStrategy } from "../config/index.js";

export class VersionCalculationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "VersionCalculationError";
	}
}

export interface VersionInfo {
	major: number;
	minor: number;
	patch: number;
	prerelease?: string;
}

export function parseVersion(version: string): VersionInfo {
	const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
	if (!match) {
		throw new VersionCalculationError(`Invalid version format: ${version}`);
	}

	const [, major, minor, patch, prerelease] = match;
	return {
		major: Number.parseInt(major, 10),
		minor: Number.parseInt(minor, 10),
		patch: Number.parseInt(patch, 10),
		prerelease,
	};
}

export function formatVersion(versionInfo: VersionInfo): string {
	const base = `${versionInfo.major}.${versionInfo.minor}.${versionInfo.patch}`;
	return versionInfo.prerelease ? `${base}-${versionInfo.prerelease}` : base;
}

export function generateTimestampSuffix(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	const hour = String(now.getHours()).padStart(2, "0");
	const minute = String(now.getMinutes()).padStart(2, "0");
	const second = String(now.getSeconds()).padStart(2, "0");
	
	return `${year}${month}${day}${hour}${minute}${second}`;
}

export function calculateNextVersion(
	baseVersion: string,
	tag: string,
	strategy: VersionSuffixStrategy,
	currentVersion?: string,
): string {
	const base = parseVersion(baseVersion);
	
	// For stable version, increment patch
	if (tag === "stable") {
		return formatVersion({
			...base,
			patch: base.patch + 1,
		});
	}

	// For non-stable versions, add prerelease suffix
	const newBase = {
		...base,
		patch: base.patch + 1,
	};

	if (strategy === "timestamp") {
		const timestampSuffix = generateTimestampSuffix();
		return formatVersion({
			...newBase,
			prerelease: `${tag}.${timestampSuffix}`,
		});
	}

	// Increment strategy
	if (currentVersion) {
		const current = parseVersion(currentVersion);
		if (current.prerelease) {
			const prereleaseMatch = current.prerelease.match(/^(.+)\.(\d+)$/);
			if (prereleaseMatch && prereleaseMatch[1] === tag) {
				const nextIncrement = Number.parseInt(prereleaseMatch[2], 10) + 1;
				return formatVersion({
					...current,
					prerelease: `${tag}.${nextIncrement}`,
				});
			}
		}
	}

	// First version with this tag
	return formatVersion({
		...newBase,
		prerelease: `${tag}.0`,
	});
}

export function getNextTagVersion(
	baseVersion: string,
	currentTag: string,
	nextTag: string,
	currentVersion?: string,
): string {
	if (nextTag === "stable") {
		if (currentVersion) {
			const current = parseVersion(currentVersion);
			return formatVersion({
				...current,
				prerelease: undefined,
			});
		}
		return calculateNextVersion(baseVersion, nextTag, "increment");
	}

	// For non-stable next tags, start from .0
	const base = parseVersion(baseVersion);
	const newBase = {
		...base,
		patch: base.patch + 1,
	};

	return formatVersion({
		...newBase,
		prerelease: `${nextTag}.0`,
	});
}