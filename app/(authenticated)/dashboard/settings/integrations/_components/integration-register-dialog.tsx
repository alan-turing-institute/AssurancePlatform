"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SCOPES } from "@/lib/auth/scopes";
import {
	type RegisterIntegrationBody,
	type RegisterIntegrationFormInput,
	registerIntegrationSchema,
} from "@/lib/schemas/integration";
import { scopeLabel } from "./integration-scope-labels";

export interface IntegrationRegisterDialogProps {
	onOpenChange: (open: boolean) => void;
	onSubmit: (input: RegisterIntegrationBody) => Promise<boolean>;
	open: boolean;
	submitting: boolean;
}

const DEFAULT_VALUES: RegisterIntegrationFormInput = {
	name: "",
	description: "",
	scopes: [],
};

/**
 * The register-integration form (functional scope item 2): name, optional
 * description, scopes as checkboxes against the closed vocabulary in
 * `lib/auth/scopes.ts` (never free text). Validated with
 * `registerIntegrationSchema` — the exact schema `POST /api/integrations`
 * validates server-side, imported and reused rather than re-declared, so the
 * two can never quietly drift apart.
 *
 * `useForm`'s field-values generic is the schema's pre-transform INPUT shape
 * (`RegisterIntegrationFormInput` — `description` still allows `null`); its
 * third (transformed-values) generic is the parsed OUTPUT shape
 * (`RegisterIntegrationBody`), which is what `handleSubmit` hands to
 * `onSubmit` below. Two different types because `optionalString`'s
 * `.transform()` folds `null`/empty into `undefined` — using the output type
 * for both, as a same-shaped schema elsewhere in the app might get away
 * with, fails `zodResolver`'s own typing here.
 *
 * Fresh fields on every open ride the parent's `key={registerDialogInstance}`
 * (`IntegrationsSection`), which remounts this whole component on each
 * "open" click — React's own recommended fix for "resetting state when a
 * prop changes" — rather than a `useEffect` watching `open` to imperatively
 * call `form.reset()` (flagged by react-doctor as event logic misplaced in
 * an effect, plus a stale-closure risk on `form.reset` as a missing dep).
 */
export function IntegrationRegisterDialog({
	onOpenChange,
	onSubmit,
	open,
	submitting,
}: IntegrationRegisterDialogProps) {
	const form = useForm<
		RegisterIntegrationFormInput,
		unknown,
		RegisterIntegrationBody
	>({
		resolver: zodResolver(registerIntegrationSchema),
		defaultValues: DEFAULT_VALUES,
	});

	async function handleSubmit(values: RegisterIntegrationBody) {
		const success = await onSubmit(values);
		if (success) {
			onOpenChange(false);
		}
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Register an integration</DialogTitle>
					<DialogDescription>
						Register an external machine client and choose which scopes it may
						authorise for. You will issue its first token afterwards.
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form
						className="space-y-6"
						onSubmit={form.handleSubmit(handleSubmit)}
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Name</FormLabel>
									<FormControl>
										<Input placeholder="example-integration" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="description"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Description</FormLabel>
									<FormControl>
										<Textarea
											placeholder="What does this integration do?"
											rows={3}
											{...field}
											value={field.value ?? ""}
										/>
									</FormControl>
									<FormDescription className="text-xs">
										Optional — helps you tell integrations apart later.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="scopes"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Scopes</FormLabel>
									<FormDescription className="text-xs">
										Choose at least one. Scopes gate which verbs this
										integration's tokens may call, not which cases it can see —
										that still rides its system user's own permissions.
									</FormDescription>
									<div className="space-y-2 pt-1">
										{SCOPES.map((scope) => {
											const checked = field.value?.includes(scope) ?? false;
											const checkboxId = `integration-scope-${scope}`;
											return (
												<div className="flex items-start gap-2" key={scope}>
													<FormControl>
														<Checkbox
															checked={checked}
															id={checkboxId}
															onCheckedChange={(next) => {
																const current = field.value ?? [];
																field.onChange(
																	next
																		? [...current, scope]
																		: current.filter((s) => s !== scope)
																);
															}}
														/>
													</FormControl>
													<Label
														className="font-normal text-sm leading-tight"
														htmlFor={checkboxId}
													>
														<span className="block">{scopeLabel(scope)}</span>
														<span className="block text-muted-foreground text-xs">
															{scope}
														</span>
													</Label>
												</div>
											);
										})}
									</div>
									<FormMessage />
								</FormItem>
							)}
						/>

						<DialogFooter>
							<Button
								disabled={submitting}
								onClick={() => onOpenChange(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button disabled={submitting} type="submit">
								{submitting ? "Registering…" : "Register integration"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
