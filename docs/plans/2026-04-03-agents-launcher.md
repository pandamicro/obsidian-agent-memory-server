# `agents` Launcher Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expose the current `projects/cli` entry point as a globally callable `agents` command on this machine, with this repository acting as the shared machine root for agent identity and memory.

**Architecture:** Add a repo-local POSIX launcher script that shells out to `node --experimental-strip-types` against the existing CLI source using the repository's absolute path. Then expose that launcher through a user-level `PATH` entry so any other project can invoke `agents ...` without knowing the repo layout. The launcher injects a shared-root environment variable so the CLI resolves storage to this repository by default, while the bare CLI still falls back to the caller's current directory when launched directly.

**Tech Stack:** POSIX shell, Node.js 24+, existing TypeScript CLI, filesystem symlink or copied launcher in `~/.local/bin`.

---

### Task 1: Add the repo-local launcher

**Files:**
- Create: `bin/agents`

**Step 1: Write the launcher**

Create a small executable shell script that:
- resolves to the repository's current absolute path
- exports the shared-root environment variable before exec
- execs `node --experimental-strip-types /Users/screamcart-agent0/obsidian-agent-memory-server/projects/cli/src/cli.ts "$@"`

**Step 2: Verify the launcher shape**

Run:
```bash
sed -n '1,80p' bin/agents
```
Expected: the script contains only forwarding logic and shared-root wiring, with no `cd` into the repo.

### Task 2: Expose the launcher in `PATH`

**Files:**
- Create or update: `~/.local/bin/agents` via a symlink or a tiny wrapper installed outside the repo

**Step 1: Install the PATH entry**

Create a user-level `agents` executable in `~/.local/bin` that points to the repo-local launcher.

**Step 2: Verify resolution**

Run:
```bash
command -v agents
```
Expected: prints the user-level launcher path.

### Task 3: Verify cross-project invocation

**Files:**
- None

**Step 1: Run from a different directory**

Run:
```bash
cd /tmp && agents verify --agent-id research-agent
```
Expected: the command reads and writes the shared machine root, so it should succeed from any directory once the shared root has the required agent assets.

**Step 2: Run from a prepared workspace**

Run:
```bash
cd /path/to/a/workspace-that-has-agents && agents verify --agent-id research-agent
```
Expected: the command succeeds because it uses the shared machine root rather than the target workspace's local files.

### Task 4: Document the new entry point

**Files:**
- Modify: `README.md`
- Modify: `projects/cli/README.md` if needed

**Step 1: Add a short usage note**

Document that `agents` is now the preferred machine-local entry point and that it executes the CLI from the caller's current directory.

**Step 2: Keep it minimal**

Do not expand the contract or introduce new runtime modes in the docs.
