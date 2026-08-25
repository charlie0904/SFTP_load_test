#!/usr/bin/env python3
"""
SFTP Upload Load Test
=====================
Concurrent Paramiko SFTP uploader for a single fixed account.

Uses real local files only (no dummy generation). Remote destinations are
relative to the SFTP session cwd, which is almost always the user's home (~/).

Quick start
-----------
    pip install paramiko
    # edit the CONFIGURATION section below
    python sftp_load_test.py

Python 3.9+

Path mapping examples
---------------------
Linux::

    "/path/to/hello.docx"          ->  "home/A/B/folder1"
    "/path/to/report.pdf"          ->  "home/A/B/folder1"
    "/data/invoices/*.pdf"         ->  "home/A/incoming/invoices/2025"
    "/photos/product-*.jpg"        ->  "uploads/images/products/active"

    Remote file becomes:
        home/A/B/folder1/[1]_hello.docx     (tagging on)
        home/A/B/folder1/hello.docx         (tagging off)

Windows (raw strings, or forward slashes)::

    r"C:\\Users\\me\\docs\\hello.docx"     ->  "home/A/B/folder1"
    r"C:\\Users\\me\\invoices\\*.pdf"      ->  "home/A/incoming/invoices/2025"
    r"D:\\photos\\product-*.jpg"           ->  "uploads/images/products/active"
    "C:/Users/me/docs/hello.docx"          ->  "home/A/B/folder1"

Sample summary (see bottom of a real run)
-----------------------------------------
::

    ================================================================
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
    ================================================================
"""

from __future__ import annotations

# >>> BEGIN CONFIG
# =============================================================================
# CONFIGURATION  —  edit this block, then run:  python sftp_load_test.py
# =============================================================================

# --- SFTP connection (single fixed user) ------------------------------------
SFTP_HOST = "sftp.example.com"
SFTP_PORT = 22
SFTP_USER = "upload_user"

# Password auth: set the password and leave SFTP_KEY_PATH = None.
# Key auth: set SFTP_KEY_PATH (and optional passphrase) and leave password None.
SFTP_PASSWORD: str | None = "change-me"
SFTP_KEY_PATH: str | None = None          # e.g. "~/.ssh/id_rsa" or r"C:\Users\me\.ssh\id_rsa"
SFTP_KEY_PASSPHRASE: str | None = None

# --- Concurrency ------------------------------------------------------------
MAX_WORKERS = 8                           # ThreadPoolExecutor size (6–8 is typical)

# --- Local file -> remote directory mappings --------------------------------
# Each entry is (local_file_or_glob, remote_dir_relative_to_home).
# Globs use standard * ? [] syntax. Only real files are uploaded; directories
# and unmatched patterns are skipped with a warning.
#
# Remote dirs are POSIX paths relative to the SFTP session cwd (~/ on most
# servers). Do not prefix with "/" unless you intentionally want an absolute
# path on the server. Do not prefix with "~/".
#
# Linux examples:
#   ("/path/to/hello.docx",          "home/A/B/folder1")
#   ("/path/to/report.pdf",          "home/A/B/folder1")
#   ("/data/invoices/*.pdf",         "home/A/incoming/invoices/2025")
#   ("/photos/product-*.jpg",        "uploads/images/products/active")
#
# Windows examples (raw strings keep backslashes literal):
#   (r"C:\Users\me\docs\hello.docx", "home/A/B/folder1")
#   (r"C:\Users\me\invoices\*.pdf",  "home/A/incoming/invoices/2025")
#   (r"D:\photos\product-*.jpg",     "uploads/images/products/active")
#   ("C:/Users/me/docs/hello.docx",  "home/A/B/folder1")   # forward slashes also work
FILE_MAPPINGS: list[tuple[str, str]] = [
    ("/path/to/hello.docx", "home/A/B/folder1"),
    ("/path/to/report.pdf", "home/A/B/folder1"),
    ("/data/invoices/*.pdf", "home/A/incoming/invoices/2025"),
    ("/photos/product-*.jpg", "uploads/images/products/active"),
]

# --- Upload technique -------------------------------------------------------
# "burst"     : submit BURST_SIZE files at once, wait BURST_INTERVAL_SEC, repeat
# "load_bomb" : copy the resolved file list x LOAD_BOMB_MULTIPLIER into a temp
#               folder, upload that set in one go, repeat LOAD_BOMB_ROUNDS times
UPLOAD_MODE = "burst"                     # "burst" | "load_bomb"

# Burst
BURST_SIZE = 4                            # files sent back-to-back per burst
BURST_INTERVAL_SEC = 60                   # wait between bursts (seconds)
BURST_CYCLES = 5                          # number of bursts; 0 = unlimited (use with TIME_LIMIT)

# Load bomb
LOAD_BOMB_MULTIPLIER = 10                 # duplicate each mapped file this many times
LOAD_BOMB_ROUNDS = 1                      # how many bomb rounds; 0 = unlimited (use with TIME_LIMIT)

# Time cap ("HH:MM"). Empty string disables.
# The run stops when this duration elapses OR when cycles/rounds complete,
# whichever happens first. Example: "00:10" = 10 minutes, "01:30" = 90 minutes.
TIME_LIMIT = ""

# --- Tagging ----------------------------------------------------------------
# Prefix remote filenames with a running counter so repeats never overwrite:
#     filename.txt  ->  [1]_filename.txt
ENABLE_TAGGING = True

# Temp directory used by load-bomb copies. None = system temp.
# Always deleted when the run finishes (success, failure, or interrupt).
TEMP_DIR: str | None = None
# <<< END CONFIG

# =============================================================================
# Implementation
# =============================================================================

import errno
import glob as globmod
import os
import queue
import shutil
import stat
import statistics
import sys
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Optional

try:
    import paramiko
except ImportError:
    sys.exit("paramiko is required. Install with:  pip install paramiko")


# --- Data types -------------------------------------------------------------

@dataclass
class Job:
    """One local file destined for one remote directory."""
    local_path: str
    remote_dir: str
    original_name: str                    # basename used for remote naming / summary


@dataclass
class Result:
    ok: bool
    original_name: str
    local_path: str
    remote_path: str
    size_bytes: int
    elapsed_sec: float
    error: str = ""


@dataclass
class SFTPConn:
    ssh: paramiko.SSHClient
    sftp: paramiko.SFTPClient

    def close(self) -> None:
        try:
            self.sftp.close()
        except Exception:
            pass
        try:
            self.ssh.close()
        except Exception:
            pass


# --- Helpers ----------------------------------------------------------------

print_lock = threading.Lock()
BYTES_PER_MB = 1024 * 1024


def log(msg: str) -> None:
    with print_lock:
        print(msg, flush=True)


def fmt_mb(n: int | float) -> str:
    return f"{n / BYTES_PER_MB:.2f} MB"


def fmt_duration(seconds: float) -> str:
    if seconds < 0:
        seconds = 0.0
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h}h {m:02d}m {s:05.2f}s"


def parse_time_limit(value: str) -> Optional[float]:
    """Return a monotonic deadline, or None if TIME_LIMIT is empty."""
    text = (value or "").strip()
    if not text:
        return None
    parts = text.split(":")
    if len(parts) != 2:
        sys.exit(f"TIME_LIMIT must be HH:MM (got {value!r})")
    try:
        hours, minutes = int(parts[0]), int(parts[1])
    except ValueError:
        sys.exit(f"TIME_LIMIT must be HH:MM (got {value!r})")
    if hours < 0 or minutes < 0 or minutes > 59:
        sys.exit(f"TIME_LIMIT must be HH:MM with minutes 0–59 (got {value!r})")
    return time.monotonic() + hours * 3600 + minutes * 60


def time_up(deadline: Optional[float]) -> bool:
    return deadline is not None and time.monotonic() >= deadline


def posix_join(directory: str, name: str) -> str:
    directory = directory.replace("\\", "/").rstrip("/")
    if directory:
        return f"{directory}/{name}"
    return name


def is_not_found(exc: BaseException) -> bool:
    if isinstance(exc, FileNotFoundError):
        return True
    err = getattr(exc, "errno", None)
    if err in (errno.ENOENT, 2):
        return True
    msg = str(exc).lower()
    return "no such file" in msg or "not found" in msg


# --- Mapping resolution (real files only) -----------------------------------

def resolve_mappings(mappings: list[tuple[str, str]]) -> list[Job]:
    """Expand globs and keep only files that exist on disk."""
    jobs: list[Job] = []
    for raw_local, raw_remote in mappings:
        remote_dir = raw_local_remote_norm(raw_remote)
        pattern = os.path.expanduser(raw_local)
        if globmod.has_magic(pattern):
            matches = sorted(p for p in globmod.glob(pattern) if os.path.isfile(p))
            if not matches:
                log(f"WARN  no files matched glob: {raw_local}")
                continue
            for path in matches:
                jobs.append(Job(path, remote_dir, os.path.basename(path)))
        else:
            if not os.path.isfile(pattern):
                log(f"WARN  not a file (skipped): {raw_local}")
                continue
            jobs.append(Job(pattern, remote_dir, os.path.basename(pattern)))
    return jobs


def raw_local_remote_norm(remote_dir: str) -> str:
    remote_dir = remote_dir.replace("\\", "/").strip()
    if remote_dir.startswith("~/"):
        remote_dir = remote_dir[2:]
        log(f"WARN  stripped '~/' from remote dir -> {remote_dir!r} (session already starts in home)")
    return remote_dir.rstrip("/")


# --- SFTP connection pool (one live session per worker) ---------------------

def open_connection() -> SFTPConn:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    kwargs: dict = {
        "hostname": SFTP_HOST,
        "port": int(SFTP_PORT),
        "username": SFTP_USER,
        "timeout": 30,
        "banner_timeout": 30,
        "auth_timeout": 30,
        "allow_agent": False,
        "look_for_keys": False,
    }
    if SFTP_KEY_PATH:
        kwargs["key_filename"] = os.path.expanduser(SFTP_KEY_PATH)
        if SFTP_KEY_PASSPHRASE:
            kwargs["passphrase"] = SFTP_KEY_PASSPHRASE
    elif SFTP_PASSWORD is not None:
        kwargs["password"] = SFTP_PASSWORD
    else:
        sys.exit("Set SFTP_PASSWORD or SFTP_KEY_PATH in the configuration block.")

    ssh.connect(**kwargs)
    try:
        transport = ssh.get_transport()
        if transport is not None:
            transport.set_keepalive(30)       # keep sockets alive across burst waits
        sftp = ssh.open_sftp()
        return SFTPConn(ssh=ssh, sftp=sftp)
    except Exception:
        try:
            ssh.close()
        except Exception:
            pass
        raise


class ConnectionPool:
    """Fixed-size pool of Paramiko sessions. SFTPClient is not thread-safe."""

    def __init__(self, size: int) -> None:
        if size < 1:
            sys.exit("MAX_WORKERS must be >= 1")
        self._q: queue.Queue[SFTPConn] = queue.Queue()
        self._all: list[SFTPConn] = []
        log(f"Opening {size} SFTP connection(s) to {SFTP_HOST}:{SFTP_PORT} as {SFTP_USER} ...")
        for i in range(size):
            try:
                conn = open_connection()
            except Exception as exc:
                self.close_all()
                raise RuntimeError(f"Connection {i + 1}/{size} failed: {exc}") from exc
            self._all.append(conn)
            self._q.put(conn)
        log("Connected.")

    def acquire(self, timeout: float = 120) -> SFTPConn:
        return self._q.get(timeout=timeout)

    def release(self, conn: SFTPConn) -> None:
        self._q.put(conn)

    def close_all(self) -> None:
        for conn in self._all:
            conn.close()
        self._all.clear()
        while not self._q.empty():
            try:
                self._q.get_nowait()
            except queue.Empty:
                break


def mkdir_p(sftp: paramiko.SFTPClient, remote_dir: str) -> None:
    """Create remote_dir and any missing parents (mkdir -p)."""
    if not remote_dir:
        return
    path = remote_dir.replace("\\", "/").strip("/")
    if not path:
        return
    current = ""
    for part in path.split("/"):
        if part in ("", "."):
            continue
        current = f"{current}/{part}" if current else part
        try:
            st = sftp.stat(current)
            if not stat.S_ISDIR(st.st_mode):
                raise RuntimeError(f"remote exists and is not a directory: {current}")
            continue
        except Exception as exc:
            if not is_not_found(exc):
                # Permission / other errors on stat should surface.
                if isinstance(exc, RuntimeError):
                    raise
                # Fall through to mkdir; if it exists we re-stat below.
        try:
            sftp.mkdir(current)
        except Exception as exc:
            try:
                st = sftp.stat(current)
                if not stat.S_ISDIR(st.st_mode):
                    raise RuntimeError(f"remote exists and is not a directory: {current}") from exc
            except Exception:
                raise RuntimeError(f"could not create remote directory {current}: {exc}") from exc


# --- Upload one file --------------------------------------------------------

def upload_one(pool: ConnectionPool, job: Job, tag: Optional[int]) -> Result:
    remote_name = f"[{tag}]_{job.original_name}" if tag is not None else job.original_name
    remote_path = posix_join(job.remote_dir, remote_name)
    try:
        size = os.path.getsize(job.local_path)
    except OSError as exc:
        log(f"FAIL {job.original_name} -> {remote_path} | {exc}")
        return Result(False, job.original_name, job.local_path, remote_path, 0, 0.0, str(exc))

    t0 = time.monotonic()
    conn = pool.acquire()
    try:
        mkdir_p(conn.sftp, job.remote_dir)
        conn.sftp.put(job.local_path, remote_path)
        elapsed = time.monotonic() - t0
        speed = (size / BYTES_PER_MB / elapsed) if elapsed > 0 else 0.0
        log(
            f"{job.original_name} -> {remote_path} | "
            f"{fmt_mb(size)} | {elapsed:.2f}s | {speed:.2f} MB/s"
        )
        return Result(True, job.original_name, job.local_path, remote_path, size, elapsed)
    except Exception as exc:
        elapsed = time.monotonic() - t0
        log(f"FAIL {job.original_name} -> {remote_path} | {exc}")
        return Result(False, job.original_name, job.local_path, remote_path, size, elapsed, str(exc))
    finally:
        pool.release(conn)


class TagCounter:
    def __init__(self) -> None:
        self._n = 0
        self._lock = threading.Lock()

    def next(self) -> Optional[int]:
        if not ENABLE_TAGGING:
            return None
        with self._lock:
            self._n += 1
            return self._n


def run_batch(
    executor: ThreadPoolExecutor,
    pool: ConnectionPool,
    jobs: list[Job],
    tags: TagCounter,
) -> list[Result]:
    """Submit jobs concurrently; continue on individual failures."""
    futures = [executor.submit(upload_one, pool, job, tags.next()) for job in jobs]
    results: list[Result] = []
    for fut in as_completed(futures):
        try:
            results.append(fut.result())
        except Exception as exc:
            log(f"FAIL worker crashed | {exc}")
            results.append(Result(False, "?", "", "", 0, 0.0, str(exc)))
    return results


# --- Burst mode -------------------------------------------------------------

def run_burst(
    executor: ThreadPoolExecutor,
    pool: ConnectionPool,
    jobs: list[Job],
    tags: TagCounter,
    deadline: Optional[float],
) -> list[Result]:
    results: list[Result] = []
    n = len(jobs)
    cursor = 0
    cycle = 0
    while True:
        cycle += 1
        if BURST_CYCLES and cycle > BURST_CYCLES:
            break
        if time_up(deadline):
            log("Time limit reached.")
            break

        batch = [jobs[(cursor + i) % n] for i in range(BURST_SIZE)]
        cursor += BURST_SIZE
        log(f"-- burst {cycle}"
            f"{'' if not BURST_CYCLES else '/' + str(BURST_CYCLES)}  "
            f"({len(batch)} files) --")
        results.extend(run_batch(executor, pool, batch, tags))

        more = (BURST_CYCLES == 0 or cycle < BURST_CYCLES)
        if more and not time_up(deadline) and BURST_INTERVAL_SEC > 0:
            remaining = BURST_INTERVAL_SEC
            if deadline is not None:
                remaining = min(remaining, max(0.0, deadline - time.monotonic()))
            if remaining > 0:
                log(f"waiting {remaining:.0f}s before next burst ...")
                time.sleep(remaining)
    return results


# --- Load-bomb mode ---------------------------------------------------------

def duplicate_into_temp(jobs: list[Job], multiplier: int, parent: Optional[str]) -> tuple[list[Job], str]:
    """Copy each local file `multiplier` times into a fresh temp folder."""
    if multiplier < 1:
        sys.exit("LOAD_BOMB_MULTIPLIER must be >= 1")
    round_dir = tempfile.mkdtemp(prefix="sftp_load_bomb_", dir=parent)
    copies: list[Job] = []
    n = 0
    for job in jobs:
        for _ in range(multiplier):
            n += 1
            dest = os.path.join(round_dir, f"{n}_{job.original_name}")
            shutil.copy2(job.local_path, dest)
            copies.append(Job(dest, job.remote_dir, job.original_name))
    return copies, round_dir


def run_load_bomb(
    executor: ThreadPoolExecutor,
    pool: ConnectionPool,
    jobs: list[Job],
    tags: TagCounter,
    deadline: Optional[float],
    temp_dirs: list[str],
) -> list[Result]:
    if not ENABLE_TAGGING:
        log("WARN  tagging is off; load-bomb repeats will overwrite the same remote names.")
    results: list[Result] = []
    round_no = 0
    parent = os.path.expanduser(TEMP_DIR) if TEMP_DIR else None
    if parent:
        os.makedirs(parent, exist_ok=True)

    while True:
        round_no += 1
        if LOAD_BOMB_ROUNDS and round_no > LOAD_BOMB_ROUNDS:
            break
        if time_up(deadline):
            log("Time limit reached.")
            break

        copies, round_dir = duplicate_into_temp(jobs, LOAD_BOMB_MULTIPLIER, parent)
        temp_dirs.append(round_dir)
        log(
            f"-- load-bomb round {round_no}"
            f"{'' if not LOAD_BOMB_ROUNDS else '/' + str(LOAD_BOMB_ROUNDS)}  "
            f"({len(copies)} files, multiplier={LOAD_BOMB_MULTIPLIER}) --"
        )
        results.extend(run_batch(executor, pool, copies, tags))

        # Drop this round's copies immediately so disk does not accumulate.
        shutil.rmtree(round_dir, ignore_errors=True)
        if round_dir in temp_dirs:
            temp_dirs.remove(round_dir)
    return results


def cleanup_temps(temp_dirs: list[str]) -> None:
    for path in temp_dirs:
        shutil.rmtree(path, ignore_errors=True)
    temp_dirs.clear()


# --- Summary ----------------------------------------------------------------

def print_summary(results: list[Result], wall_sec: float) -> None:
    ok = [r for r in results if r.ok]
    fail = [r for r in results if not r.ok]
    total_bytes = sum(r.size_bytes for r in ok)
    times = [r.elapsed_sec for r in ok]
    median = statistics.median(times) if times else None
    mbps = (total_bytes * 8 / 1_000_000 / wall_sec) if wall_sec > 0 else 0.0

    if UPLOAD_MODE == "burst":
        mode = f"burst  (size={BURST_SIZE}, interval={BURST_INTERVAL_SEC}s, cycles={BURST_CYCLES or 'unlimited'})"
    else:
        mode = f"load_bomb  (multiplier={LOAD_BOMB_MULTIPLIER}, rounds={LOAD_BOMB_ROUNDS or 'unlimited'})"

    # Unique original names with size (first observed size) and upload count.
    unique: dict[tuple[str, int], int] = {}
    for r in ok:
        key = (r.original_name, r.size_bytes)
        unique[key] = unique.get(key, 0) + 1
    rows = sorted(unique.items(), key=lambda kv: (-kv[0][1], kv[0][0].lower()))

    line = "=" * 64
    thin = "-" * 64
    print()
    print(line)
    print(" SFTP LOAD TEST SUMMARY")
    print(line)
    print(f"  Host              : {SFTP_HOST}:{SFTP_PORT}")
    print(f"  User              : {SFTP_USER}")
    print(f"  Mode              : {mode}")
    print(f"  Workers           : {MAX_WORKERS}")
    print(f"  Tagging           : {'on' if ENABLE_TAGGING else 'off'}")
    if TIME_LIMIT.strip():
        print(f"  Time limit        : {TIME_LIMIT.strip()}")
    print()
    print(f"  Time taken        : {fmt_duration(wall_sec)}")
    print(f"  Files attempted   : {len(results)}")
    print(f"  Files uploaded    : {len(ok)}")
    print(f"  Failures          : {len(fail)}")
    print(f"  Total transferred : {fmt_mb(total_bytes)}")
    print(f"  Throughput        : {mbps:.2f} Mbps")
    print(f"  Median time       : {median:.2f} s" if median is not None else "  Median time       : n/a")
    print()
    print("  UNIQUE FILES (sorted by size, descending)")
    print("  " + thin)
    print(f"  {'Original name':<38} {'Size':<12} {'Uploads':<8}")
    if not rows:
        print("  (none)")
    else:
        for (name, size), count in rows:
            print(f"  {name:<38} {fmt_mb(size):<12} {count:<8}")
    print("  " + thin)
    print(f"  Unique files      : {len(rows)}")
    print(f"  Total transferred : {fmt_mb(total_bytes)}")
    if fail:
        print()
        print("  FAILURES")
        for r in fail[:20]:
            print(f"  - {r.original_name} -> {r.remote_path} | {r.error}")
        if len(fail) > 20:
            print(f"  - ... {len(fail) - 20} more")
    print(line)


# --- Main -------------------------------------------------------------------

def validate_config() -> None:
    if UPLOAD_MODE not in ("burst", "load_bomb"):
        sys.exit("UPLOAD_MODE must be 'burst' or 'load_bomb'")
    if MAX_WORKERS < 1:
        sys.exit("MAX_WORKERS must be >= 1")
    if UPLOAD_MODE == "burst" and BURST_SIZE < 1:
        sys.exit("BURST_SIZE must be >= 1")
    if UPLOAD_MODE == "load_bomb" and LOAD_BOMB_MULTIPLIER < 1:
        sys.exit("LOAD_BOMB_MULTIPLIER must be >= 1")
    unlimited = (UPLOAD_MODE == "burst" and BURST_CYCLES == 0) or (
        UPLOAD_MODE == "load_bomb" and LOAD_BOMB_ROUNDS == 0
    )
    if unlimited and not (TIME_LIMIT or "").strip():
        sys.exit("Unlimited cycles/rounds require TIME_LIMIT (HH:MM) to be set.")


def main() -> int:
    validate_config()
    jobs = resolve_mappings(FILE_MAPPINGS)
    if not jobs:
        log("No local files resolved from FILE_MAPPINGS. Check paths and globs.")
        return 1

    log(f"Resolved {len(jobs)} local file(s):")
    for job in jobs:
        try:
            size = os.path.getsize(job.local_path)
        except OSError:
            size = 0
        log(f"  {job.local_path} -> {job.remote_dir}/  ({fmt_mb(size)})")

    deadline = parse_time_limit(TIME_LIMIT)
    tags = TagCounter()
    temp_dirs: list[str] = []
    results: list[Result] = []
    pool: Optional[ConnectionPool] = None
    t0 = time.monotonic()
    try:
        pool = ConnectionPool(MAX_WORKERS)
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            if UPLOAD_MODE == "burst":
                results = run_burst(executor, pool, jobs, tags, deadline)
            else:
                results = run_load_bomb(executor, pool, jobs, tags, deadline, temp_dirs)
    except KeyboardInterrupt:
        log("\nInterrupted — printing partial summary.")
    except Exception as exc:
        log(f"Aborted: {exc}")
    finally:
        if pool is not None:
            pool.close_all()
        cleanup_temps(temp_dirs)
        log("Temp folders removed.")

    print_summary(results, time.monotonic() - t0)
    failures = sum(1 for r in results if not r.ok)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
