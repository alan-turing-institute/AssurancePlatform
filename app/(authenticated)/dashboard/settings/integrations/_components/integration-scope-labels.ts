import type { Scope } from "@/lib/auth/scopes";

/**
 * Human-readable labels for the closed scope vocabulary (`lib/auth/
 * scopes.ts`). A `Partial` record, not a full one, so adding a new scope to
 * `SCOPES` (an ADR amendment, per that file's own doc comment) can't fail to
 * compile here — `scopeLabel` below falls back to the raw scope string for
 * anything this map hasn't caught up with yet, rather than the settings UI
 * breaking on an unrecognised-but-valid scope.
 */
const SCOPE_LABELS: Partial<Record<Scope, string>> = {
	"case:read": "Read cases",
	"health:evidence:read": "Read claim/evidence health data",
	"health:evidence:write": "Write claim/evidence health data",
};

/** A short, human-readable label for a scope string, falling back to the raw value. */
export function scopeLabel(scope: string): string {
	return SCOPE_LABELS[scope as Scope] ?? scope;
}
