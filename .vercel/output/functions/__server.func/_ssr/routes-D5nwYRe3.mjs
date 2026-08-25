import { i as __toESM } from "../_runtime.mjs";
import { L as require_react, v as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Plus, c as Download, d as Check, f as ArrowRight, i as Terminal, l as Copy, o as Layers, r as Trash2, s as FolderTree, t as Upload, u as Clock3 } from "../_libs/lucide-react.mjs";
import { t as clsx } from "../_libs/clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-D5nwYRe3.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var LINUX_PRESET = [
	{
		id: "l1",
		local: "/path/to/hello.docx",
		remote: "home/A/B/folder1"
	},
	{
		id: "l2",
		local: "/path/to/report.pdf",
		remote: "home/A/B/folder1"
	},
	{
		id: "l3",
		local: "/data/invoices/*.pdf",
		remote: "home/A/incoming/invoices/2025"
	},
	{
		id: "l4",
		local: "/photos/product-*.jpg",
		remote: "uploads/images/products/active"
	}
];
var WINDOWS_PRESET = [
	{
		id: "w1",
		local: String.raw`C:\Users\me\docs\hello.docx`,
		remote: "home/A/B/folder1"
	},
	{
		id: "w2",
		local: String.raw`C:\Users\me\docs\report.pdf`,
		remote: "home/A/B/folder1"
	},
	{
		id: "w3",
		local: String.raw`C:\Users\me\invoices\*.pdf`,
		remote: "home/A/incoming/invoices/2025"
	},
	{
		id: "w4",
		local: String.raw`D:\photos\product-*.jpg`,
		remote: "uploads/images/products/active"
	}
];
var DEFAULT_CONFIG = {
	host: "sftp.example.com",
	port: 22,
	user: "upload_user",
	password: "change-me",
	keyPath: "",
	keyPassphrase: "",
	maxWorkers: 8,
	mappings: LINUX_PRESET.map((m) => ({ ...m })),
	mode: "burst",
	burstSize: 4,
	burstInterval: 60,
	burstCycles: 5,
	bombMultiplier: 10,
	bombRounds: 1,
	timeLimit: "",
	tagging: true
};
function pyStr(value) {
	return JSON.stringify(value);
}
function pyOptional(value) {
	const trimmed = value.trim();
	return trimmed ? pyStr(trimmed) : "None";
}
function pyLocalPath(local) {
	if (local.includes("\\")) return `r"${local.replace(/"/g, "\\\"")}"`;
	return pyStr(local);
}
function newMapping() {
	return {
		id: `m-${Math.random().toString(36).slice(2, 9)}`,
		local: "",
		remote: ""
	};
}
function generateConfigBlock(cfg) {
	const passwordLine = cfg.keyPath.trim() ? `SFTP_PASSWORD: str | None = None` : `SFTP_PASSWORD: str | None = ${pyOptional(cfg.password)}`;
	const mappingLines = cfg.mappings.filter((m) => m.local.trim() && m.remote.trim()).map((m) => `    (${pyLocalPath(m.local.trim())}, ${pyStr(m.remote.trim())}),`).join("\n");
	return `# >>> BEGIN CONFIG
# =============================================================================
# CONFIGURATION  —  edit this block, then run:  python sftp_load_test.py
# =============================================================================

# --- SFTP connection (single fixed user) ------------------------------------
SFTP_HOST = ${pyStr(cfg.host.trim() || "sftp.example.com")}
SFTP_PORT = ${Number.isFinite(cfg.port) ? cfg.port : 22}
SFTP_USER = ${pyStr(cfg.user.trim() || "upload_user")}

# Password auth: set the password and leave SFTP_KEY_PATH = None.
# Key auth: set SFTP_KEY_PATH (and optional passphrase) and leave password None.
${passwordLine}
SFTP_KEY_PATH: str | None = ${pyOptional(cfg.keyPath)}
SFTP_KEY_PASSPHRASE: str | None = ${pyOptional(cfg.keyPassphrase)}

# --- Concurrency ------------------------------------------------------------
MAX_WORKERS = ${Math.max(1, Math.floor(cfg.maxWorkers) || 8)}

# --- Local file -> remote directory mappings --------------------------------
# Each entry is (local_file_or_glob, remote_dir_relative_to_home).
# Remote dirs are POSIX paths relative to the SFTP session cwd (~/ on most servers).
FILE_MAPPINGS: list[tuple[str, str]] = [
${mappingLines || "    # add (local_path, remote_dir) tuples here"}
]

# --- Upload technique -------------------------------------------------------
# "burst"     : submit BURST_SIZE files at once, wait BURST_INTERVAL_SEC, repeat
# "load_bomb" : copy the resolved file list x LOAD_BOMB_MULTIPLIER into a temp
#               folder, upload that set in one go, repeat LOAD_BOMB_ROUNDS times
UPLOAD_MODE = ${pyStr(cfg.mode)}

# Burst
BURST_SIZE = ${Math.max(1, Math.floor(cfg.burstSize) || 4)}
BURST_INTERVAL_SEC = ${Math.max(0, Number(cfg.burstInterval) || 0)}
BURST_CYCLES = ${Math.max(0, Math.floor(cfg.burstCycles) || 0)}

# Load bomb
LOAD_BOMB_MULTIPLIER = ${Math.max(1, Math.floor(cfg.bombMultiplier) || 10)}
LOAD_BOMB_ROUNDS = ${Math.max(0, Math.floor(cfg.bombRounds) || 0)}

# Time cap ("HH:MM"). Empty string disables.
TIME_LIMIT = ${pyStr(cfg.timeLimit.trim())}

# --- Tagging ----------------------------------------------------------------
# Prefix remote filenames with a running counter so repeats never overwrite:
#     filename.txt  ->  [1]_filename.txt
ENABLE_TAGGING = ${cfg.tagging ? "True" : "False"}

# Temp directory used by load-bomb copies. None = system temp.
TEMP_DIR: str | None = None
# <<< END CONFIG`;
}
function spliceScript(template, cfg) {
	const block = generateConfigBlock(cfg);
	return template.replace(/# >>> BEGIN CONFIG[\s\S]*?# <<< END CONFIG/, block);
}
var SAMPLE_SUMMARY = `================================================================
 SFTP LOAD TEST SUMMARY
================================================================
  Host              : sftp.example.com:22
  User              : upload_user
  Mode              : burst  (size=4, interval=60s, cycles=5)
  Workers           : 8
  Tagging           : on

  Time taken        : 0h 05m 12.34s
  Files attempted   : 20
  Files uploaded    : 19
  Failures          : 1
  Total transferred : 48.72 MB
  Throughput        : 12.51 Mbps
  Median time       : 1.18 s

  UNIQUE FILES (sorted by size, descending)
  ----------------------------------------------------------------
  Original name                          Size         Uploads
  report.pdf                             8.12 MB      5
  hello.docx                             2.45 MB      5
  invoice_001.pdf                        0.41 MB      5
  product-red.jpg                        1.20 MB      4
  ----------------------------------------------------------------
  Unique files      : 4
  Total transferred : 48.72 MB
================================================================`;
var SAMPLE_PROGRESS = `Resolved 4 local file(s):
  /path/to/hello.docx -> home/A/B/folder1/  (2.45 MB)
  /path/to/report.pdf -> home/A/B/folder1/  (8.12 MB)
  /data/invoices/invoice_001.pdf -> home/A/incoming/invoices/2025/  (0.41 MB)
  /photos/product-red.jpg -> uploads/images/products/active/  (1.20 MB)
Opening 8 SFTP connection(s) to sftp.example.com:22 as upload_user ...
Connected.
-- burst 1/5  (4 files) --
hello.docx -> home/A/B/folder1/[1]_hello.docx | 2.45 MB | 1.21s | 2.02 MB/s
invoice_001.pdf -> home/A/incoming/invoices/2025/[3]_invoice_001.pdf | 0.41 MB | 0.38s | 1.08 MB/s
product-red.jpg -> uploads/images/products/active/[4]_product-red.jpg | 1.20 MB | 0.71s | 1.69 MB/s
report.pdf -> home/A/B/folder1/[2]_report.pdf | 8.12 MB | 3.04s | 2.67 MB/s
waiting 60s before next burst ...`;
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function Home() {
	const [cfg, setCfg] = (0, import_react.useState)(DEFAULT_CONFIG);
	const [template, setTemplate] = (0, import_react.useState)("");
	const [copied, setCopied] = (0, import_react.useState)(null);
	const [osPreset, setOsPreset] = (0, import_react.useState)("linux");
	(0, import_react.useEffect)(() => {
		fetch("/sftp_load_test.py").then((r) => r.text()).then(setTemplate).catch(() => setTemplate(""));
	}, []);
	const configBlock = (0, import_react.useMemo)(() => generateConfigBlock(cfg), [cfg]);
	const fullScript = (0, import_react.useMemo)(() => template ? spliceScript(template, cfg) : configBlock, [
		template,
		cfg,
		configBlock
	]);
	function patch(partial) {
		setCfg((prev) => ({
			...prev,
			...partial
		}));
	}
	function setMapping(id, next) {
		setCfg((prev) => ({
			...prev,
			mappings: prev.mappings.map((m) => m.id === id ? {
				...m,
				...next
			} : m)
		}));
	}
	function applyPreset(kind) {
		setOsPreset(kind);
		patch({ mappings: (kind === "linux" ? LINUX_PRESET : WINDOWS_PRESET).map((m) => ({ ...m })) });
	}
	async function copyText(text, which) {
		await navigator.clipboard.writeText(text);
		setCopied(which);
		window.setTimeout(() => setCopied(null), 1600);
	}
	function downloadScript() {
		const blob = new Blob([fullScript], { type: "text/x-python" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "sftp_load_test.py";
		a.click();
		URL.revokeObjectURL(url);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen bg-bg text-fg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
			className: "sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur-md",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex min-w-0 items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "flex size-9 items-center justify-center rounded-md bg-raised text-primary",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, {
							className: "size-4",
							strokeWidth: 2
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate text-sm font-semibold tracking-tight",
							children: "SFTP Load Test"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate text-xs text-muted",
							children: "Paramiko · Python 3.9+"
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "btn-primary shrink-0",
					onClick: downloadScript,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-4" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "hidden sm:inline",
							children: "Download script"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "sm:hidden",
							children: "Download"
						})
					]
				})]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "max-w-3xl",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-medium uppercase tracking-widest text-primary",
							children: "Python load tester"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "mt-3 text-3xl font-semibold tracking-tight sm:text-4xl",
							children: "Upload real files over SFTP, on purpose, at volume."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-4 max-w-2xl text-base leading-relaxed text-muted",
							children: "A single-file Paramiko script for one fixed SFTP user. Map local files or globs to remote folders, push them concurrently, then print a run summary. This page fills in the config block — the script itself runs on a machine that can reach your SFTP server."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-6 flex flex-wrap gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
								href: "#config",
								className: "btn-primary",
								children: ["Configure", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-4" })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href: "#summary",
								className: "btn-ghost",
								children: "Sample summary"
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-12 grid gap-4 sm:grid-cols-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModeCard, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Layers, { className: "size-4" }),
							title: "Burst",
							body: "Submit ~4 files at once through a thread pool, wait 60s, repeat. Cycle count and interval are configurable."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModeCard, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderTree, { className: "size-4" }),
							title: "Load bomb",
							body: "Duplicate the resolved file list by X into a temp folder, upload the set in one go, repeat for R rounds, then delete temp."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModeCard, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock3, { className: "size-4" }),
							title: "Time cap",
							body: "Optional HH:MM wall clock. The run stops when time elapses or when cycles/rounds finish — whichever comes first."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-14",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-xl font-semibold tracking-tight",
							children: "File mapping"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 max-w-2xl text-sm leading-relaxed text-muted",
							children: [
								"Each row is a real local file or glob, sent to a remote directory relative to the SFTP session home (usually ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-fg",
									children: "~/"
								}),
								"). Remote folders are created automatically. Tagging prefixes names so repeats never overwrite:",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-fg",
									children: " filename.txt → [1]_filename.txt"
								}),
								"."
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-6 grid gap-4 lg:grid-cols-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MappingExample, {
								title: "Linux",
								rows: [
									["\"/path/to/hello.docx\"", "\"home/A/B/folder1\""],
									["\"/path/to/report.pdf\"", "\"home/A/B/folder1\""],
									["\"/data/invoices/*.pdf\"", "\"home/A/incoming/invoices/2025\""],
									["\"/photos/product-*.jpg\"", "\"uploads/images/products/active\""]
								],
								result: "\"/path/to/hello.docx\" → home/A/B/folder1/[1]_hello.docx"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MappingExample, {
								title: "Windows",
								rows: [
									["r\"C:\\Users\\me\\docs\\hello.docx\"", "\"home/A/B/folder1\""],
									["r\"C:\\Users\\me\\docs\\report.pdf\"", "\"home/A/B/folder1\""],
									["r\"C:\\Users\\me\\invoices\\*.pdf\"", "\"home/A/incoming/invoices/2025\""],
									["r\"D:\\photos\\product-*.jpg\"", "\"uploads/images/products/active\""]
								],
								result: "r\"C:\\\\Users\\\\me\\\\docs\\\\hello.docx\" → home/A/B/folder1/[1]_hello.docx"
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					id: "config",
					className: "mt-16 scroll-mt-24",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-end justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-xl font-semibold tracking-tight",
							children: "Configuration"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm text-muted",
							children: "Values land in the top-of-file config block. Download splices them into the full script."
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "btn-ghost",
							onClick: () => copyText(configBlock, "config"),
							children: [copied === "config" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-4" }), copied === "config" ? "Copied" : "Copy config"]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-6 grid gap-6 lg:grid-cols-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							className: "card lg:col-span-3 p-5 sm:p-6",
							onSubmit: (e) => {
								e.preventDefault();
								downloadScript();
							},
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-sm font-semibold uppercase tracking-wider text-muted",
									children: "Connection"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-4 grid gap-4 sm:grid-cols-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
											label: "Host",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "field-input font-mono",
												value: cfg.host,
												onChange: (e) => patch({ host: e.target.value }),
												autoComplete: "off"
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
											label: "Port",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "field-input font-mono",
												type: "number",
												min: 1,
												max: 65535,
												value: cfg.port,
												onChange: (e) => patch({ port: Number(e.target.value) })
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
											label: "User",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "field-input font-mono",
												value: cfg.user,
												onChange: (e) => patch({ user: e.target.value }),
												autoComplete: "off"
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
											label: "Password (leave empty if using a key)",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "field-input font-mono",
												type: "password",
												value: cfg.password,
												onChange: (e) => patch({ password: e.target.value }),
												autoComplete: "off"
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
											label: "Private key path",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "field-input font-mono",
												placeholder: "~/.ssh/id_rsa",
												value: cfg.keyPath,
												onChange: (e) => patch({ keyPath: e.target.value })
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
											label: "Key passphrase",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "field-input font-mono",
												type: "password",
												value: cfg.keyPassphrase,
												onChange: (e) => patch({ keyPassphrase: e.target.value }),
												autoComplete: "off"
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
											label: "Concurrency (workers)",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "field-input font-mono",
												type: "number",
												min: 1,
												max: 64,
												value: cfg.maxWorkers,
												onChange: (e) => patch({ maxWorkers: Number(e.target.value) })
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
											label: "Time limit (HH:MM, optional)",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "field-input font-mono",
												placeholder: "00:10",
												value: cfg.timeLimit,
												onChange: (e) => patch({ timeLimit: e.target.value })
											})
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "mt-8 text-sm font-semibold uppercase tracking-wider text-muted",
									children: "Mode"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 grid grid-cols-2 gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModeToggle, {
										active: cfg.mode === "burst",
										label: "Burst",
										onClick: () => patch({ mode: "burst" })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModeToggle, {
										active: cfg.mode === "load_bomb",
										label: "Load bomb",
										onClick: () => patch({ mode: "load_bomb" })
									})]
								}),
								cfg.mode === "burst" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-4 grid gap-4 sm:grid-cols-3",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
											label: "Burst size",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "field-input font-mono",
												type: "number",
												min: 1,
												value: cfg.burstSize,
												onChange: (e) => patch({ burstSize: Number(e.target.value) })
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
											label: "Interval (seconds)",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "field-input font-mono",
												type: "number",
												min: 0,
												value: cfg.burstInterval,
												onChange: (e) => patch({ burstInterval: Number(e.target.value) })
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
											label: "Cycles (0 = until time limit)",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "field-input font-mono",
												type: "number",
												min: 0,
												value: cfg.burstCycles,
												onChange: (e) => patch({ burstCycles: Number(e.target.value) })
											})
										})
									]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-4 grid gap-4 sm:grid-cols-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										label: "Multiplier (X copies)",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											className: "field-input font-mono",
											type: "number",
											min: 1,
											value: cfg.bombMultiplier,
											onChange: (e) => patch({ bombMultiplier: Number(e.target.value) })
										})
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										label: "Rounds (0 = until time limit)",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											className: "field-input font-mono",
											type: "number",
											min: 0,
											value: cfg.bombRounds,
											onChange: (e) => patch({ bombRounds: Number(e.target.value) })
										})
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "mt-5 flex min-h-11 cursor-pointer items-center gap-3 text-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "checkbox",
										className: "size-4 accent-primary",
										checked: cfg.tagging,
										onChange: (e) => patch({ tagging: e.target.checked })
									}), "Tag remote names with a running prefix"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-8 flex flex-wrap items-center justify-between gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-sm font-semibold uppercase tracking-wider text-muted",
										children: "Mappings"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-wrap gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: cn("btn-ghost h-11 px-3 text-xs", osPreset === "linux" && "bg-raised"),
											onClick: () => applyPreset("linux"),
											children: "Linux examples"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: cn("btn-ghost h-11 px-3 text-xs", osPreset === "windows" && "bg-raised"),
											onClick: () => applyPreset("windows"),
											children: "Windows examples"
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-4 space-y-3",
									children: cfg.mappings.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid gap-2 sm:grid-cols-[1fr_1fr_auto]",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "field-input font-mono",
												placeholder: "local file or glob",
												value: m.local,
												onChange: (e) => setMapping(m.id, { local: e.target.value })
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "field-input font-mono",
												placeholder: "remote dir (relative to home)",
												value: m.remote,
												onChange: (e) => setMapping(m.id, { remote: e.target.value })
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												className: "btn-ghost h-11 min-w-11 px-0",
												"aria-label": "Remove mapping",
												onClick: () => patch({ mappings: cfg.mappings.filter((row) => row.id !== m.id) }),
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" })
											})
										]
									}, m.id))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "btn-ghost mt-3",
									onClick: () => patch({ mappings: [...cfg.mappings, newMapping()] }),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "Add mapping"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "submit",
									className: "btn-primary mt-8 w-full sm:w-auto",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-4" }), "Download sftp_load_test.py"]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
							className: "card panel-scroll lg:col-span-2 flex flex-col overflow-hidden p-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex items-center justify-between border-b border-border px-4 py-3",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Terminal, { className: "size-3.5" }), "Config block"]
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
								className: "flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-fg",
								children: configBlock
							})]
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					id: "summary",
					className: "mt-16 scroll-mt-24",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-xl font-semibold tracking-tight",
							children: "What a run looks like"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 max-w-2xl text-sm leading-relaxed text-muted",
							children: "Per file: name → remote path | size MB | time | speed MB/s. Failures print and the rest continue. After the run: successes, unique file sizes, total transferred, wall time, throughput in Mbps, median upload time."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-6 grid gap-4 lg:grid-cols-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TerminalBlock, {
								title: "Per-file progress",
								body: SAMPLE_PROGRESS
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TerminalBlock, {
								title: "Final summary",
								body: SAMPLE_SUMMARY
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-16",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-end justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-xl font-semibold tracking-tight",
								children: "Run it"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm text-muted",
								children: "Python 3.9+, real files on disk, one SFTP account. No dummy generation."
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "btn-ghost",
								onClick: () => copyText(fullScript, "script"),
								children: [copied === "script" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-4" }), copied === "script" ? "Copied" : "Copy script"]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
							className: "mt-6 grid gap-3 sm:grid-cols-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Step, {
									n: "1",
									title: "Install",
									body: "pip install paramiko"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Step, {
									n: "2",
									title: "Point at real files",
									body: "Edit FILE_MAPPINGS or use the form above."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Step, {
									n: "3",
									title: "Run",
									body: "python sftp_load_test.py"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "card script-panel mt-6 overflow-hidden p-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between border-b border-border px-4 py-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-xs text-muted",
									children: "sftp_load_test.py"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "btn-ghost h-11 px-3 text-xs",
									onClick: downloadScript,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-3.5" }), "Download"]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
								className: "script-scroll overflow-auto p-4 font-mono text-xs leading-relaxed text-fg",
								children: fullScript
							})]
						})
					]
				})
			]
		})]
	});
}
function Field({ label, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "block",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "mb-1.5 block text-xs font-medium text-muted",
			children: label
		}), children]
	});
}
function ModeCard({ icon, title, body }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "card p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex size-9 items-center justify-center rounded-md bg-raised text-primary",
				children: icon
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "mt-4 text-base font-semibold",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm leading-relaxed text-muted",
				children: body
			})
		]
	});
}
function ModeToggle({ active, label, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		className: cn("h-11 rounded-md border text-sm font-medium transition-colors duration-150", active ? "border-primary bg-primary text-bg" : "border-border bg-transparent text-fg hover:bg-raised"),
		children: label
	});
}
function MappingExample({ title, rows, result }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "card overflow-hidden p-0",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "border-b border-border px-4 py-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "text-sm font-semibold",
					children: title
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "overflow-x-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full min-w-80 text-left text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "text-muted",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-border",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-2 font-medium",
								children: "Local"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-2 font-medium",
								children: "Remote dir"
							})]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
						className: "font-mono",
						children: rows.map(([local, remote]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-border last:border-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-2 align-top",
								children: local
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-2 align-top text-muted",
								children: remote
							})]
						}, local))
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "border-t border-border px-4 py-3 font-mono text-xs text-muted",
				children: result
			})
		]
	});
}
function TerminalBlock({ title, body }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "card overflow-hidden p-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "border-b border-border px-4 py-3",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "text-sm font-semibold",
				children: title
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
			className: "overflow-x-auto p-4 font-mono text-xs leading-relaxed text-fg",
			children: body
		})]
	});
}
function Step({ n, title, body }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "card flex gap-3 p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "flex size-8 shrink-0 items-center justify-center rounded-md bg-raised font-mono text-sm text-primary",
			children: n
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm font-semibold",
			children: title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 font-mono text-xs text-muted",
			children: body
		})] })]
	});
}
//#endregion
export { Home as component };
