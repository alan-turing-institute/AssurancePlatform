/** The message part type the panel renders as a notice when a reply was cut short. */
export const ABORT_NOTICE_PART = "data-notice";

const TIMEOUT_NOTICE =
	"The model did not answer in time. Try again or ask something shorter.";
const LENGTH_NOTICE =
	"The model ran out of room before answering. Try a narrower question, or a different chat model.";

/**
 * The notice for a `data-notice` part's data: "length" when the model used up
 * its output limit, and the time limit's wording for any other value.
 */
export function noticeText(reason: unknown): string {
	return reason === "length" ? LENGTH_NOTICE : TIMEOUT_NOTICE;
}
