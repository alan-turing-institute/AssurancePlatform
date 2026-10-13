/** The message part type of a notice the panel shows under a reply. The route adds some, and the browser adds the timeout one. */
export const NOTICE_PART = "data-notice";

/** What a notice part's data says happened to the reply. */
export const NOTICE_REASON = {
	/** The model call was cancelled when it ran past its time limit. */
	timeout: "timeout",
	/** The model used up its output limit before it had finished. */
	length: "length",
	/** The model's first step produced nothing to show: no text, thinking or tool call. */
	empty: "empty",
	/** The reply used up its allowed steps while the model was still calling tools. */
	steps: "steps",
} as const;

/** Shown under a reply that finished with no answer text and no other notice. */
export const SILENT_REPLY_NOTICE =
	"The assistant stopped without writing an answer. Try asking again, or ask something narrower.";
const TIMEOUT_NOTICE =
	"The model did not answer in time. Try again or ask something shorter.";
const LENGTH_NOTICE =
	"The model ran out of room before answering. Try a narrower question, or a different chat model.";
const STEP_LIMIT_NOTICE =
	"The assistant reached its step limit for one reply before it finished answering.";

/**
 * The notice for a `data-notice` part's data. Each value of `NOTICE_REASON` has
 * its own wording, and the time limit's wording stands for any other value.
 */
export function noticeText(reason: unknown): string {
	switch (reason) {
		case NOTICE_REASON.length:
			return LENGTH_NOTICE;
		case NOTICE_REASON.empty:
			return SILENT_REPLY_NOTICE;
		case NOTICE_REASON.steps:
			return STEP_LIMIT_NOTICE;
		default:
			return TIMEOUT_NOTICE;
	}
}
