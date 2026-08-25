import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  Copy,
  Download,
  FolderTree,
  Layers,
  Plus,
  Terminal,
  Trash2,
  Upload,
} from "lucide-react";
import {
  DEFAULT_CONFIG,
  LINUX_PRESET,
  SAMPLE_PROGRESS,
  SAMPLE_SUMMARY,
  WINDOWS_PRESET,
  generateConfigBlock,
  newMapping,
  spliceScript,
  type FileMapping,
  type ScriptConfig,
  type UploadMode,
} from "@/lib/script-config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [cfg, setCfg] = useState<ScriptConfig>(DEFAULT_CONFIG);
  const [template, setTemplate] = useState("");
  const [copied, setCopied] = useState<"script" | "config" | null>(null);
  const [osPreset, setOsPreset] = useState<"linux" | "windows">("linux");

  useEffect(() => {
    fetch("/sftp_load_test.py")
      .then((r) => r.text())
      .then(setTemplate)
      .catch(() => setTemplate(""));
  }, []);

  const configBlock = useMemo(() => generateConfigBlock(cfg), [cfg]);
  const fullScript = useMemo(
    () => (template ? spliceScript(template, cfg) : configBlock),
    [template, cfg, configBlock],
  );

  function patch(partial: Partial<ScriptConfig>) {
    setCfg((prev) => ({ ...prev, ...partial }));
  }

  function setMapping(id: string, next: Partial<FileMapping>) {
    setCfg((prev) => ({
      ...prev,
      mappings: prev.mappings.map((m) => (m.id === id ? { ...m, ...next } : m)),
    }));
  }

  function applyPreset(kind: "linux" | "windows") {
    setOsPreset(kind);
    patch({ mappings: (kind === "linux" ? LINUX_PRESET : WINDOWS_PRESET).map((m) => ({ ...m })) });
  }

  async function copyText(text: string, which: "script" | "config") {
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

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-raised text-primary">
              <Upload className="size-4" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">SFTP Load Test</p>
              <p className="truncate text-xs text-muted">Paramiko · Python 3.9+</p>
            </div>
          </div>
          <button type="button" className="btn-primary shrink-0" onClick={downloadScript}>
            <Download className="size-4" />
            <span className="hidden sm:inline">Download script</span>
            <span className="sm:hidden">Download</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <section className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">Python load tester</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Upload real files over SFTP, on purpose, at volume.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
            A single-file Paramiko script for one fixed SFTP user. Map local files or globs to remote
            folders, push them concurrently, then print a run summary. This page fills in the config
            block — the script itself runs on a machine that can reach your SFTP server.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#config" className="btn-primary">
              Configure
              <ArrowRight className="size-4" />
            </a>
            <a href="#summary" className="btn-ghost">
              Sample summary
            </a>
          </div>
        </section>

        <section className="mt-12 grid gap-4 sm:grid-cols-3">
          <ModeCard
            icon={<Layers className="size-4" />}
            title="Burst"
            body="Submit ~4 files at once through a thread pool, wait 60s, repeat. Cycle count and interval are configurable."
          />
          <ModeCard
            icon={<FolderTree className="size-4" />}
            title="Load bomb"
            body="Duplicate the resolved file list by X into a temp folder, upload the set in one go, repeat for R rounds, then delete temp."
          />
          <ModeCard
            icon={<Clock3 className="size-4" />}
            title="Time cap"
            body="Optional HH:MM wall clock. The run stops when time elapses or when cycles/rounds finish — whichever comes first."
          />
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-semibold tracking-tight">File mapping</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Each row is a real local file or glob, sent to a remote directory relative to the SFTP
            session home (usually <span className="font-mono text-fg">~/</span>). Remote folders are
            created automatically. Tagging prefixes names so repeats never overwrite:
            <span className="font-mono text-fg"> filename.txt → [1]_filename.txt</span>.
          </p>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <MappingExample
              title="Linux"
              rows={[
                ['"/path/to/hello.docx"', '"home/A/B/folder1"'],
                ['"/path/to/report.pdf"', '"home/A/B/folder1"'],
                ['"/data/invoices/*.pdf"', '"home/A/incoming/invoices/2025"'],
                ['"/photos/product-*.jpg"', '"uploads/images/products/active"'],
              ]}
              result='"/path/to/hello.docx" → home/A/B/folder1/[1]_hello.docx'
            />
            <MappingExample
              title="Windows"
              rows={[
                ['r"C:\\Users\\me\\docs\\hello.docx"', '"home/A/B/folder1"'],
                ['r"C:\\Users\\me\\docs\\report.pdf"', '"home/A/B/folder1"'],
                ['r"C:\\Users\\me\\invoices\\*.pdf"', '"home/A/incoming/invoices/2025"'],
                ['r"D:\\photos\\product-*.jpg"', '"uploads/images/products/active"'],
              ]}
              result='r"C:\\Users\\me\\docs\\hello.docx" → home/A/B/folder1/[1]_hello.docx'
            />
          </div>
        </section>

        <section id="config" className="mt-16 scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Configuration</h2>
              <p className="mt-2 text-sm text-muted">
                Values land in the top-of-file config block. Download splices them into the full script.
              </p>
            </div>
            <button type="button" className="btn-ghost" onClick={() => copyText(configBlock, "config")}>
              {copied === "config" ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied === "config" ? "Copied" : "Copy config"}
            </button>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-5">
            <form
              className="card lg:col-span-3 p-5 sm:p-6"
              onSubmit={(e) => {
                e.preventDefault();
                downloadScript();
              }}
            >
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Connection</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Host">
                  <input
                    className="field-input font-mono"
                    value={cfg.host}
                    onChange={(e) => patch({ host: e.target.value })}
                    autoComplete="off"
                  />
                </Field>
                <Field label="Port">
                  <input
                    className="field-input font-mono"
                    type="number"
                    min={1}
                    max={65535}
                    value={cfg.port}
                    onChange={(e) => patch({ port: Number(e.target.value) })}
                  />
                </Field>
                <Field label="User">
                  <input
                    className="field-input font-mono"
                    value={cfg.user}
                    onChange={(e) => patch({ user: e.target.value })}
                    autoComplete="off"
                  />
                </Field>
                <Field label="Password (leave empty if using a key)">
                  <input
                    className="field-input font-mono"
                    type="password"
                    value={cfg.password}
                    onChange={(e) => patch({ password: e.target.value })}
                    autoComplete="off"
                  />
                </Field>
                <Field label="Private key path">
                  <input
                    className="field-input font-mono"
                    placeholder="~/.ssh/id_rsa"
                    value={cfg.keyPath}
                    onChange={(e) => patch({ keyPath: e.target.value })}
                  />
                </Field>
                <Field label="Key passphrase">
                  <input
                    className="field-input font-mono"
                    type="password"
                    value={cfg.keyPassphrase}
                    onChange={(e) => patch({ keyPassphrase: e.target.value })}
                    autoComplete="off"
                  />
                </Field>
                <Field label="Concurrency (workers)">
                  <input
                    className="field-input font-mono"
                    type="number"
                    min={1}
                    max={64}
                    value={cfg.maxWorkers}
                    onChange={(e) => patch({ maxWorkers: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Time limit (HH:MM, optional)">
                  <input
                    className="field-input font-mono"
                    placeholder="00:10"
                    value={cfg.timeLimit}
                    onChange={(e) => patch({ timeLimit: e.target.value })}
                  />
                </Field>
              </div>

              <h3 className="mt-8 text-sm font-semibold uppercase tracking-wider text-muted">Mode</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <ModeToggle
                  active={cfg.mode === "burst"}
                  label="Burst"
                  onClick={() => patch({ mode: "burst" satisfies UploadMode })}
                />
                <ModeToggle
                  active={cfg.mode === "load_bomb"}
                  label="Load bomb"
                  onClick={() => patch({ mode: "load_bomb" })}
                />
              </div>

              {cfg.mode === "burst" ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <Field label="Burst size">
                    <input
                      className="field-input font-mono"
                      type="number"
                      min={1}
                      value={cfg.burstSize}
                      onChange={(e) => patch({ burstSize: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Interval (seconds)">
                    <input
                      className="field-input font-mono"
                      type="number"
                      min={0}
                      value={cfg.burstInterval}
                      onChange={(e) => patch({ burstInterval: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Cycles (0 = until time limit)">
                    <input
                      className="field-input font-mono"
                      type="number"
                      min={0}
                      value={cfg.burstCycles}
                      onChange={(e) => patch({ burstCycles: Number(e.target.value) })}
                    />
                  </Field>
                </div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Multiplier (X copies)">
                    <input
                      className="field-input font-mono"
                      type="number"
                      min={1}
                      value={cfg.bombMultiplier}
                      onChange={(e) => patch({ bombMultiplier: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Rounds (0 = until time limit)">
                    <input
                      className="field-input font-mono"
                      type="number"
                      min={0}
                      value={cfg.bombRounds}
                      onChange={(e) => patch({ bombRounds: Number(e.target.value) })}
                    />
                  </Field>
                </div>
              )}

              <label className="mt-5 flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={cfg.tagging}
                  onChange={(e) => patch({ tagging: e.target.checked })}
                />
                Tag remote names with a running prefix
              </label>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Mappings</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={cn("btn-ghost h-11 px-3 text-xs", osPreset === "linux" && "bg-raised")}
                    onClick={() => applyPreset("linux")}
                  >
                    Linux examples
                  </button>
                  <button
                    type="button"
                    className={cn("btn-ghost h-11 px-3 text-xs", osPreset === "windows" && "bg-raised")}
                    onClick={() => applyPreset("windows")}
                  >
                    Windows examples
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {cfg.mappings.map((m) => (
                  <div key={m.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input
                      className="field-input font-mono"
                      placeholder="local file or glob"
                      value={m.local}
                      onChange={(e) => setMapping(m.id, { local: e.target.value })}
                    />
                    <input
                      className="field-input font-mono"
                      placeholder="remote dir (relative to home)"
                      value={m.remote}
                      onChange={(e) => setMapping(m.id, { remote: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn-ghost h-11 min-w-11 px-0"
                      aria-label="Remove mapping"
                      onClick={() =>
                        patch({ mappings: cfg.mappings.filter((row) => row.id !== m.id) })
                      }
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn-ghost mt-3"
                onClick={() => patch({ mappings: [...cfg.mappings, newMapping()] })}
              >
                <Plus className="size-4" />
                Add mapping
              </button>

              <button type="submit" className="btn-primary mt-8 w-full sm:w-auto">
                <Download className="size-4" />
                Download sftp_load_test.py
              </button>
            </form>

            <aside className="card panel-scroll lg:col-span-2 flex flex-col overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted">
                  <Terminal className="size-3.5" />
                  Config block
                </span>
              </div>
              <pre className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-fg">
                {configBlock}
              </pre>
            </aside>
          </div>
        </section>

        <section id="summary" className="mt-16 scroll-mt-24">
          <h2 className="text-xl font-semibold tracking-tight">What a run looks like</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Per file: name → remote path | size MB | time | speed MB/s. Failures print and the rest
            continue. After the run: successes, unique file sizes, total transferred, wall time,
            throughput in Mbps, median upload time.
          </p>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <TerminalBlock title="Per-file progress" body={SAMPLE_PROGRESS} />
            <TerminalBlock title="Final summary" body={SAMPLE_SUMMARY} />
          </div>
        </section>

        <section className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Run it</h2>
              <p className="mt-2 text-sm text-muted">
                Python 3.9+, real files on disk, one SFTP account. No dummy generation.
              </p>
            </div>
            <button type="button" className="btn-ghost" onClick={() => copyText(fullScript, "script")}>
              {copied === "script" ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied === "script" ? "Copied" : "Copy script"}
            </button>
          </div>
          <ol className="mt-6 grid gap-3 sm:grid-cols-3">
            <Step n="1" title="Install" body="pip install paramiko" />
            <Step n="2" title="Point at real files" body="Edit FILE_MAPPINGS or use the form above." />
            <Step n="3" title="Run" body="python sftp_load_test.py" />
          </ol>
          <div className="card script-panel mt-6 overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="font-mono text-xs text-muted">sftp_load_test.py</span>
              <button type="button" className="btn-ghost h-11 px-3 text-xs" onClick={downloadScript}>
                <Download className="size-3.5" />
                Download
              </button>
            </div>
            <pre className="script-scroll overflow-auto p-4 font-mono text-xs leading-relaxed text-fg">
              {fullScript}
            </pre>
          </div>
        </section>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function ModeCard({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <article className="card p-5">
      <div className="flex size-9 items-center justify-center rounded-md bg-raised text-primary">{icon}</div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </article>
  );
}

function ModeToggle({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-11 rounded-md border text-sm font-medium transition-colors duration-150",
        active
          ? "border-primary bg-primary text-bg"
          : "border-border bg-transparent text-fg hover:bg-raised",
      )}
    >
      {label}
    </button>
  );
}

function MappingExample({
  title,
  rows,
  result,
}: {
  title: string;
  rows: [string, string][];
  result: string;
}) {
  return (
    <div className="card overflow-hidden p-0">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-80 text-left text-xs">
          <thead className="text-muted">
            <tr className="border-b border-border">
              <th className="px-4 py-2 font-medium">Local</th>
              <th className="px-4 py-2 font-medium">Remote dir</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.map(([local, remote]) => (
              <tr key={local} className="border-b border-border last:border-0">
                <td className="px-4 py-2 align-top">{local}</td>
                <td className="px-4 py-2 align-top text-muted">{remote}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-4 py-3 font-mono text-xs text-muted">{result}</p>
    </div>
  );
}

function TerminalBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="card overflow-hidden p-0">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-fg">{body}</pre>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="card flex gap-3 p-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-raised font-mono text-sm text-primary">
        {n}
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 font-mono text-xs text-muted">{body}</p>
      </div>
    </li>
  );
}
