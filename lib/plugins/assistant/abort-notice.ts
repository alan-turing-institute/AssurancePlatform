/** The message part type of a notice the panel shows under a reply. The route adds some, and the browser adds the timeout one. */
export const NOTICE_PART = "data-notice";

/** What a notice part's data says happened to the reply. */
export const NOTICE_REASON = {
	/** The model call was cancelled when it ran past its time limit. */
	timeout: "timeout",
	/** The model used up its output limit before it had finished. */
	length: "length",
} as const;

const TIMEOUT_NOTICE =
	"The model did not answer in time. Try again or ask something shorter.";
const LENGTH_NOTICE =
	"The model ran out of room before answering. Try a narrower question, or a different chat model.";

/**
 * The notice for a `data-notice` part's data: the output limit's wording for
 * `NOTICE_REASON.length`, and the time limit's wording for any other value.
 */
export function noticeText(reason: unknown): string {
	return reason === NOTICE_REASON.length ? LENGTH_NOTICE : TIMEOUT_NOTICE;
}
