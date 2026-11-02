type Fact = string | number | boolean | undefined;

// Facts only, as IDs and codes. An email or a name must never reach the logs.
export function logWarning(name: string, facts: Record<string, Fact>) {
  console.warn(JSON.stringify({ ...facts, log: name }));
}
