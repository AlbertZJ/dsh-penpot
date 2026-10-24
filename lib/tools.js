import { PenpotClient, PenpotError } from "./client.js";
import { defineTool } from "@deepseek-ai/dsh-tools";
// src/tools.ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
function requireUuid(value, field) {
	if (!UUID_RE.test(value)) throw new PenpotError(`penpot: ${field} must be a UUID, got "${value.slice(0, 40)}"`);
	return value.toLowerCase();
}
/** Fail fast with setup guidance when the token is missing. */
function clientOf(connection) {
	const token = process.env[connection.tokenRef]?.trim();
	if (token === void 0 || token === "") throw new PenpotError(`penpot: ${connection.tokenRef} is not set. Create a personal access token in Penpot (Settings → Access tokens) and export it: export ${connection.tokenRef}=<token>`);
	return new PenpotClient(connection.baseUrl, token, connection.timeoutMs);
}
/** Read one string field from an untyped Penpot payload. */
function strOf(value) {
	return typeof value === "string" ? value : void 0;
}
/** Kept small on purpose: full file payloads can reach tens of MB. */
const MAX_TREE_NODES = 300;
/** Shrink one Penpot page's object map into a frame tree for the model. */
function boardTreeOf(page) {
	const objects = page.objects ?? {};
	const visited = /* @__PURE__ */ new Set();
	let nodes = 0;
	const build = (id, depth) => {
		if (nodes >= MAX_TREE_NODES || visited.has(id) || depth > 12) return void 0;
		const object = objects[id];
		if (object === void 0) return void 0;
		visited.add(id);
		nodes += 1;
		const children = (Array.isArray(object.shapes) ? object.shapes.filter((shape) => typeof shape === "string") : []).map((shapeId) => build(shapeId, depth + 1)).filter((child) => child !== void 0);
		return {
			name: strOf(object.name) ?? "(unnamed)",
			type: strOf(object.type) ?? "unknown",
			...typeof object.width === "number" ? { width: object.width } : {},
			...typeof object.height === "number" ? { height: object.height } : {},
			...children.length > 0 ? { children } : {}
		};
	};
	const children = Object.keys(objects).filter((id) => {
		const object = objects[id];
		return strOf(object?.type) === "frame" && (object?.["frame-id"] === void 0 || object["frame-id"] === null);
	}).map((id) => build(id, 0)).filter((child) => child !== void 0);
	return {
		tree: {
			name: strOf(page.name) ?? "(page)",
			type: "page",
			...children.length > 0 ? { children } : {}
		},
		nodes
	};
}
/** Register every Penpot tool on the scoped tool registry. */
function registerTools(ctx, connection) {
	const jsonBody = (value) => ({ body: JSON.stringify(value) });
	ctx.tools.register(defineTool({
		name: "penpot_whoami",
		description: [
			"Check the Penpot connection and return the authenticated profile (id, name, email).",
			"Use first to confirm the plugin is configured before any other penpot_* call.",
			`Talks to ${connection.baseUrl}.`
		].join(" "),
		parameters: {},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: { body: {
					type: "string",
					required: true,
					description: "The get-profile response as a JSON string."
				} }
			},
			render: (_args, value) => [{
				type: "text",
				text: `Penpot profile: ${value.body}`
			}]
		},
		execute: async () => jsonBody(await clientOf(connection).rpc("get-profile"))
	}));
	ctx.tools.register(defineTool({
		name: "penpot_list_teams",
		description: "List the Penpot teams the token can see (id, name, isDefault). Use penpot_list_projects next with one team id.",
		parameters: {},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: { body: {
					type: "string",
					required: true,
					description: "The get-teams response as a JSON string."
				} }
			},
			render: (_args, value) => [{
				type: "text",
				text: `Penpot teams: ${value.body}`
			}]
		},
		execute: async () => jsonBody(await clientOf(connection).rpc("get-teams"))
	}));
	ctx.tools.register(defineTool({
		name: "penpot_list_projects",
		description: "List projects inside one Penpot team. Omit teamId to use the first (usually personal) team.",
		parameters: { teamId: {
			type: "string",
			description: "Team UUID from penpot_list_teams. Omit to use the first team."
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					teamId: {
						type: "string",
						required: true,
						description: "The team the projects belong to."
					},
					body: {
						type: "string",
						required: true,
						description: "The get-projects response as a JSON string."
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `Penpot projects in team ${value.teamId}: ${value.body}`
			}]
		},
		execute: async (args) => {
			const client = clientOf(connection);
			let teamId = strOf(args.teamId);
			if (teamId === void 0) {
				const first = (await client.rpc("get-teams"))[0];
				teamId = first === void 0 ? void 0 : strOf(first.id);
				if (teamId === void 0) throw new PenpotError("penpot: no teams visible to this token");
			} else teamId = requireUuid(teamId, "teamId");
			return {
				teamId,
				body: JSON.stringify(await client.rpc("get-projects", { "team-id": teamId }))
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "penpot_list_files",
		description: "List files (design drafts) inside one Penpot project: id, name, last modified. Use penpot_get_file_overview on one file id next.",
		parameters: { projectId: {
			type: "string",
			required: true,
			description: "Project UUID from penpot_list_projects."
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: { body: {
					type: "string",
					required: true,
					description: "The get-project-files response as a JSON string."
				} }
			},
			render: (_args, value) => [{
				type: "text",
				text: `Penpot files: ${value.body}`
			}]
		},
		execute: async (args) => {
			const projectId = requireUuid(strOf(args.projectId) ?? "", "projectId");
			return jsonBody(await clientOf(connection).rpc("get-project-files", { "project-id": projectId }));
		}
	}));
	ctx.tools.register(defineTool({
		name: "penpot_search_files",
		description: "Search Penpot files by name across everything the token can access. Faster than walking teams → projects → files when you know (part of) the name.",
		parameters: { term: {
			type: "string",
			required: true,
			description: "Name fragment to search for, e.g. \"landing\"."
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: { body: {
					type: "string",
					required: true,
					description: "The search-files response as a JSON string."
				} }
			},
			render: (_args, value) => [{
				type: "text",
				text: `Penpot search results: ${value.body}`
			}]
		},
		execute: async (args) => jsonBody(await clientOf(connection).rpc("search-files", { "search-term": String(args.term ?? "") }))
	}));
	ctx.tools.register(defineTool({
		name: "penpot_get_file_overview",
		description: ["Get one file's summary: pages, permissions, and the design-token sets attached to the file.", "Cheaper than reading whole pages — use it to plan which page/board to inspect with penpot_get_board_tree."].join(" "),
		parameters: { fileId: {
			type: "string",
			required: true,
			description: "File UUID."
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: { body: {
					type: "string",
					required: true,
					description: "get-file-summary merged with a get-file-tokens summary as a JSON string."
				} }
			},
			render: (_args, value) => [{
				type: "text",
				text: `Penpot file overview: ${value.body}`
			}]
		},
		execute: async (args) => {
			const client = clientOf(connection);
			const fileId = requireUuid(strOf(args.fileId) ?? "", "fileId");
			const summary = await client.rpc("get-file-summary", { id: fileId });
			const tokens = await client.rpc("get-file-tokens", { "file-id": fileId }).catch(() => void 0);
			const tokenSets = tokens === void 0 ? void 0 : Array.isArray(tokens["sets"]) ? tokens["sets"].length : void 0;
			return jsonBody({
				...summary,
				tokenSets: tokenSets ?? "unavailable"
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "penpot_get_board_tree",
		description: ["Read one page of a Penpot file as a compact tree of frames/boards with names, types, and sizes.", "Omit pageId to read the first page. Capped: at most 300 nodes, depth 12 — for details on one board, ask again and summarize."].join(" "),
		parameters: {
			fileId: {
				type: "string",
				required: true,
				description: "File UUID."
			},
			pageId: {
				type: "string",
				description: "Page UUID from penpot_get_file_overview. Omit for the first page."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					body: {
						type: "string",
						required: true,
						description: "The page frame tree as a JSON string: {name, type, width, height, children}."
					},
					truncated: {
						type: "boolean",
						required: true,
						description: "True when the node cap cut the tree."
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `Penpot board tree: ${value.body}`
			}]
		},
		execute: async (args) => {
			const params = { "file-id": requireUuid(strOf(args.fileId) ?? "", "fileId") };
			const pageId = strOf(args.pageId);
			if (pageId !== void 0) params["page-id"] = requireUuid(pageId, "pageId");
			const { tree, nodes } = boardTreeOf(await clientOf(connection).rpc("get-page", params));
			return {
				body: JSON.stringify(tree),
				truncated: nodes >= MAX_TREE_NODES
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "penpot_read_comments",
		description: "Read the open comment threads on one Penpot file: who, where (page/position), and what. Use for design-review rounds and handoff checklists.",
		parameters: { fileId: {
			type: "string",
			required: true,
			description: "File UUID."
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: { body: {
					type: "string",
					required: true,
					description: "The get-comment-threads response as a JSON string."
				} }
			},
			render: (_args, value) => [{
				type: "text",
				text: `Penpot comments: ${value.body}`
			}]
		},
		execute: async (args) => {
			const fileId = requireUuid(strOf(args.fileId) ?? "", "fileId");
			return jsonBody(await clientOf(connection).rpc("get-comment-threads", { "file-id": fileId }));
		}
	}));
	ctx.tools.register(defineTool({
		name: "penpot_export_file",
		description: ["Export one Penpot file as a binary .penpot archive (the portable format Penpot itself uses for backups/imports).", "Returns the local file path and byte size; the archive contains all pages and assets, and can be re-imported into any Penpot deployment."].join(" "),
		parameters: { fileId: {
			type: "string",
			required: true,
			description: "File UUID."
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					path: {
						type: "string",
						required: true,
						description: "Local .penpot archive path."
					},
					bytes: {
						type: "number",
						required: true,
						description: "Archive size in bytes."
					},
					url: {
						type: "string",
						required: true,
						description: "Temporary asset URL the archive was downloaded from."
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `Penpot export: ${value.path} (${String(value.bytes)} bytes)`
			}]
		},
		presentCall: (args) => ({
			card: "generic",
			title: `Export Penpot file ${args.fileId}`,
			kind: "other",
			rawInput: args
		}),
		execute: async (args) => {
			const fileId = requireUuid(strOf(args.fileId) ?? "", "fileId");
			return clientOf(connection).exportBinfile(fileId);
		}
	}));
}
export { boardTreeOf, registerTools };
