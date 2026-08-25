export type UploadMode = "burst" | "load_bomb";

export type FileMapping = {
  id: string;
  local: string;
  remote: string;
};

export type ScriptConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  keyPath: string;
  keyPassphrase: string;
  maxWorkers: number;
  mappings: FileMapping[];
  mode: UploadMode;
  burstSize: number;
  burstInterval: number;
  burstCycles: number;
  bombMultiplier: number;
  bombRounds: number;
  timeLimit: string;
  tagging: boolean;
};

export const LINUX_PRESET: FileMapping[] = [
  { id: "l1", local: "/path/to/hello.docx", remote: "home/A/B/folder1" },
  { id: "l2", local: "/path/to/report.pdf", remote: "home/A/B/folder1" },
  { id: "l3", local: "/data/invoices/*.pdf", remote: "home/A/incoming/invoices/2025" },
  { id: "l4", local: "/photos/product-*.jpg", remote: "uploads/images/products/active" },
];

export const WINDOWS_PRESET: FileMapping[] = [
  { id: "w1", local: String.raw`C:\Users\me\docs\hello.docx`, remote: "home/A/B/folder1" },
  { id: "w2", local: String.raw`C:\Users\me\docs\report.pdf`, remote: "home/A/B/folder1" },
  { id: "w3", local: String.raw`C:\Users\me\invoices\*.pdf`, remote: "home/A/incoming/invoices/2025" },
  { id: "w4", local: String.raw`D:\photos\product-*.jpg`, remote: "uploads/images/products/active" },
];

export const DEFAULT_CONFIG: ScriptConfig = {
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
  tagging: true,
};

function pyStr(value: string): string {
  return JSON.stringify(value);
}

function pyOptional(value: string): string {
  const trimmed = value.trim();
  return trimmed ? pyStr(trimmed) : "None";
}

function pyLocalPath(local: string): string {
  // Emit a raw string when the path contains backslashes (Windows).
  if (local.includes("\\")) {
    return `r"${local.replace(/"/g, '\\"')}"`;
  }
  return pyStr(local);
}

export function newMapping(): FileMapping {
  return {
    id: `m-${Math.random().toString(36).slice(2, 9)}`,
    local: "",
    remote: "",
  };
}

export function generateConfigBlock(cfg: ScriptConfig): string {
  const passwordLine = cfg.keyPath.trim()
    ? `SFTP_PASSWORD: str | None = None`
    : `SFTP_PASSWORD: str | None = ${pyOptional(cfg.password)}`;

  const mappingLines = cfg.mappings
    .filter((m) => m.local.trim() && m.remote.trim())
    .map((m) => `    (${pyLocalPath(m.local.trim())}, ${pyStr(m.remote.trim())}),`)
    .join("\n");

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

export function spliceScript(template: string, cfg: ScriptConfig): string {
  const block = generateConfigBlock(cfg);
  const replaced = template.replace(/# >>> BEGIN CONFIG[\s\S]*?# <<< END CONFIG/, block);
  return replaced;
}

export const SAMPLE_SUMMARY = `================================================================
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

export const SAMPLE_PROGRESS = `Resolved 4 local file(s):
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
