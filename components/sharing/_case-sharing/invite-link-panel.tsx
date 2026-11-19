import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface InviteLinkPanelProps {
	copied: boolean;
	inviteUrl: string;
	onClear: () => void;
	onCopy: () => void;
}

export function InviteLinkPanel({
	inviteUrl,
	copied,
	onCopy,
	onClear,
}: InviteLinkPanelProps) {
	return (
		<div className="space-y-3">
			<p className="text-muted-foreground text-sm">
				User not found. Share this invite link with them:
			</p>
			<div className="flex gap-2">
				<Input readOnly value={inviteUrl} />
				<Button
					onClick={onCopy}
					size="icon"
					title={copied ? "Copied" : "Copy invite link"}
					variant="outline"
				>
					{copied ? (
						<Check className="h-4 w-4" />
					) : (
						<Copy className="h-4 w-4" />
					)}
				</Button>
			</div>
			<Button className="w-full" onClick={onClear} variant="outline">
				Share with someone else
			</Button>
		</div>
	);
}
