export function asBoolean(arg: unknown): boolean {
	if (typeof arg !== "boolean")
		throw new Error("Not a boolean")
	return arg
}

export function asString(arg: unknown): string {
	if (typeof arg !== "string")
		throw new Error("Not a string")
	return arg
}

export function asSnowflake(arg: unknown): `${bigint}` {
	const str = asString(arg)
	if (!str)
		throw new Error("Empty string is not a Snowflake")
	return `${BigInt(str)}`
}
