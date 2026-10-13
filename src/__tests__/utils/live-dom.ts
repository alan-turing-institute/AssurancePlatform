/**
 * Helpers for asserting that rendered, untrusted text left nothing in the page
 * that could run script, fetch a resource or navigate on its own.
 */

const INERT_TAGS =
	"script,iframe,frame,frameset,object,embed,applet,img,picture,source,video,audio,track,link,meta,base,style,form,input,textarea,select,canvas";
const FETCHING_ATTRIBUTES = [
	"src",
	"srcset",
	"poster",
	"background",
	"action",
	"formaction",
	"data",
	"ping",
	"longdesc",
];
export const SAFE_HREF = /^(https?:\/\/|mailto:)/i;
const FETCHING_STYLE = /url\(|expression\(/i;
const SCRIPT_URL = /(javascript|vbscript):/i;
export const LINK_LIKE = 'a, [role="link"], [data-streamdown="link"]';

/** Everything under the root that could run script, fetch a resource or navigate on its own. */
export function liveParts(root: ParentNode): string[] {
	const found: string[] = [];
	for (const element of root.querySelectorAll("*")) {
		const tag = element.tagName.toLowerCase();
		if (element.matches(INERT_TAGS)) {
			found.push(`<${tag}>`);
		}
		for (const { name, value } of Array.from(element.attributes)) {
			const attribute = name.toLowerCase();
			if (
				attribute.startsWith("on") ||
				FETCHING_ATTRIBUTES.includes(attribute)
			) {
				found.push(`<${tag} ${name}>`);
			} else if (
				(attribute === "href" || attribute === "xlink:href") &&
				!SAFE_HREF.test(value.trim())
			) {
				found.push(`<${tag} ${name}="${value}">`);
			} else if (SCRIPT_URL.test(value)) {
				found.push(`<${tag} ${name}="${value}">`);
			} else if (attribute === "style" && FETCHING_STYLE.test(value)) {
				found.push(`<${tag} style="${value}">`);
			}
		}
	}
	return found;
}
