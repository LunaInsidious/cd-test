import { z } from "zod";

const versionSuffixStrategySchema = z.enum(["timestamp", "increment"]);

const versionTagSchema = z.record(
	z.string(),
	z.object({
		versionSuffixStrategy: versionSuffixStrategySchema.default("timestamp"),
		next: z.string().optional(),
	}),
);

const projectTypeSchema = z.enum(["typescript", "rust"]);

const registrySchema = z.enum(["npm", "crates", "docker"]);

const projectSchema = z.object({
	path: z.string(),
	type: projectTypeSchema,
	registries: z.array(registrySchema),
});

const releaseNotesSchema = z.object({
	enabled: z.boolean(),
	template: z.string(),
});

export const configSchema = z.object({
	baseVersion: z
		.string()
		.regex(/^\d+\.\d+\.\d+$/, "Invalid semantic version format"),
	versionTags: z.array(versionTagSchema),
	projects: z.array(projectSchema),
	releaseNotes: releaseNotesSchema,
});

export type Config = z.infer<typeof configSchema>;
export type VersionTag = z.infer<typeof versionTagSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ReleaseNotes = z.infer<typeof releaseNotesSchema>;
export type ProjectType = z.infer<typeof projectTypeSchema>;
export type Registry = z.infer<typeof registrySchema>;
export type VersionSuffixStrategy = z.infer<typeof versionSuffixStrategySchema>;
