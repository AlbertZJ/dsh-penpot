import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
// src/client.ts
/**
* Minimal Penpot REST/RPC client.
*
* Talks directly to Penpot's backend command API (`POST /api/rpc/command/<name>`,
* `Authorization: Token <access-token>`). No MCP involved: the plugin itself is
* the integration. Verified against penpot/penpot backend sources
* (backend/src/app/http/middleware.clj for the Token scheme,
* backend/src/app/rpc/commands/*.clj for command params).
*/
/** A token/permission problem or a Penpot-side error, in agent-readable form. */
var PenpotError = class extends Error {};
/** Parse a text/event-stream body into events (tolerant of CRLF and multi-line data). */
function parseSse(text) {
	const events = [];
	let event = "message";
	let data = [];
	const flush = () => {
		if (data.length > 0) events.push({
			event,
			data: data.join("\n")
		});
		event = "message";
		data = [];
	};
	for (const line of text.split(/\r?\n/u)) {
		if (line === "") {
			flush();
			continue;
		}
		if (line.startsWith(":")) continue;
		const colon = line.indexOf(":");
		const field = colon === -1 ? line : line.slice(0, colon);
		let value = colon === -1 ? "" : line.slice(colon + 1);
		if (value.startsWith(" ")) value = value.slice(1);
		if (field === "event") event = value;
		else if (field === "data") data.push(value);
	}
	flush();
	return events;
}
function errorHint(status, body) {
	try {
		const parsed = JSON.parse(body);
		const parts = [
			parsed.type,
			parsed.code,
			parsed.hint
		].filter((part) => typeof part === "string" && part.length > 0);
		if (parts.length > 0) return parts.join(": ");
	} catch {}
	const trimmed = body.trim();
	return trimmed.length > 0 ? trimmed.slice(0, 300) : `HTTP ${String(status)}`;
}
/** Penpot backend client bound to one base URL and one access token. */
var PenpotClient = class {
	baseUrl;
	token;
	timeoutMs;
	constructor(baseUrl, token, timeoutMs) {
		this.baseUrl = baseUrl;
		this.token = token;
		this.timeoutMs = timeoutMs;
	}
	/** Invoke one RPC command and return the decoded JSON body. */
	async rpc(command, params = {}) {
		const url = `${this.baseUrl.replace(/\/+$/u, "")}/api/rpc/command/${command}`;
		let response;
		try {
			response = await fetch(url, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Token ${this.token}`
				},
				body: JSON.stringify(params),
				signal: AbortSignal.timeout(this.timeoutMs)
			});
		} catch (cause) {
			throw new PenpotError(`penpot: cannot reach ${this.baseUrl} (${command}): ${cause instanceof Error ? cause.message : String(cause)}`);
		}
		const body = await response.text();
		if (!response.ok) {
			if (response.status === 401 || response.status === 403) throw new PenpotError(`penpot: authentication failed (HTTP ${String(response.status)}): check PENPOT_TOKEN`);
			throw new PenpotError(`penpot: ${command} failed — ${errorHint(response.status, body)}`);
		}
		if (body.length === 0) return void 0;
		try {
			return JSON.parse(body);
		} catch {
			throw new PenpotError(`penpot: ${command} returned non-JSON (first 200 chars): ${body.slice(0, 200)}`);
		}
	}
	/**
	* Export one file as a binary `.penpot` archive.
	* The command streams progress over SSE and ends with an event whose payload
	* carries a temporary asset URI; download it to a local temp file.
	* @returns Local file path, byte size, and the temporary asset URL.
	*/
	async exportBinfile(fileId) {
		const origin = this.baseUrl.replace(/\/+$/u, "");
		const response = await fetch(`${origin}/api/rpc/command/export-binfile`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Token ${this.token}`,
				accept: "text/event-stream"
			},
			body: JSON.stringify({ "file-id": fileId }),
			signal: AbortSignal.timeout(this.timeoutMs * 4)
		});
		if (!response.ok) {
			const body = await response.text();
			if (response.status === 401 || response.status === 403) throw new PenpotError(`penpot: authentication failed (HTTP ${String(response.status)}): check PENPOT_TOKEN`);
			throw new PenpotError(`penpot: export-binfile failed — ${errorHint(response.status, body)}`);
		}
		const events = parseSse(await response.text());
		let assetUrl;
		const errors = [];
		for (const { event, data } of events) {
			if (event === "error" || event === "failure") errors.push(data);
			try {
				const payload = JSON.parse(data);
				if (typeof payload === "object" && payload !== null) {
					const uri = payload.uri ?? payload.url;
					if (typeof uri === "string" && uri.length > 0) assetUrl = uri;
				}
			} catch {}
		}
		if (assetUrl === void 0) {
			const tail = events.slice(-3).map((event) => `${event.event}: ${event.data.slice(0, 200)}`).join(" | ");
			throw new PenpotError(`penpot: export-binfile produced no download uri${errors.length > 0 ? ` (errors: ${errors.join(" | ")})` : ""}; stream tail: ${tail}`);
		}
		const absolute = assetUrl.startsWith("http") ? assetUrl : `${origin}${assetUrl.startsWith("/") ? "" : "/"}${assetUrl}`;
		const directory = join(tmpdir(), "dsh-penpot");
		await mkdir(directory, { recursive: true });
		const path = join(directory, `${fileId}.penpot`);
		const download = await fetch(absolute, { signal: AbortSignal.timeout(this.timeoutMs * 4) });
		if (!download.ok) throw new PenpotError(`penpot: download failed (HTTP ${String(download.status)})`);
		const buffer = Buffer.from(await download.arrayBuffer());
		await writeFile(path, buffer);
		return {
			path,
			bytes: buffer.byteLength,
			url: absolute
		};
	}
};
export { PenpotClient, PenpotError, parseSse };
