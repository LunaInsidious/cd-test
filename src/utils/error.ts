import { getSystemErrorMap } from "node:util";

export class NotFoundError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "NotFoundError";
	}
}

export class ValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ValidationError";
	}
}

// ref: https://github.com/nodejs/node/issues/46869
const systemErrorMap = getSystemErrorMap();
export function isSystemError(error: unknown): error is NodeJS.ErrnoException {
	if (!(error instanceof Error) || !Object.hasOwn(error, "errno")) {
		return false;
	}

	const { errno } = <typeof error & { errno: unknown }>error;

	return typeof errno === "number" && systemErrorMap.has(errno);
}
