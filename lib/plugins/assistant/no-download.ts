import type { Experimental_DownloadFunction } from "ai";

/** The only message a refused download produces; it carries no address. */
export const DOWNLOAD_REFUSED_MESSAGE =
	"The assistant does not fetch files from addresses.";

/**
 * Replaces the AI SDK's file downloader. By default the SDK fetches, on the
 * server, every file URL in a message that the model cannot take as a URL
 * itself, over plain http, following redirects and reading up to 2 GiB. This
 * function never fetches anything: a URL the model takes directly is passed
 * through to the provider unchanged, and any other URL fails the call with a
 * fixed message that does not name it.
 */
export const noDownload: Experimental_DownloadFunction = (requests) => {
	if (requests.some((request) => !request.isUrlSupportedByModel)) {
		return Promise.reject(new Error(DOWNLOAD_REFUSED_MESSAGE));
	}
	return Promise.resolve(requests.map(() => null));
};
