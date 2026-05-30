# Dev Setup — Hi Again

One-time setup for contributors / when working locally outside Emergent.

## Pre-commit hooks (recommended)

Catches real bugs **before** they hit a commit. Runs the same Ruff + ESLint
that already pass cleanly across the codebase, plus secret-scanning and JSON
validation. If a finding doesn't show up here, the external "code quality
report" tool that generated it is wrong — ignore it.

### Install
```bash
pip install pre-commit
pre-commit install        # registers the git hook
```

That's it. From now on every `git commit` runs:

1. **Ruff** on changed Python files — checks for undefined names, unused
   imports, mutable-default args, etc. Cosmetic/style rules are off by design.
2. **ESLint** (flat config at `frontend/eslint.config.mjs`) on changed
   JS/JSX — `react-hooks/exhaustive-deps`, `no-undef`, `no-unused-vars`,
   `no-shadow-restricted-names`.
3. **Gitleaks + detect-private-key** — blocks accidental commits of API keys,
   tokens, or private keys.
4. **JSON/YAML syntax check + large-file guard** — stops broken configs and
   accidentally committed photos / AABs.

### Run against the whole repo on demand
```bash
pre-commit run --all-files
```

### Skip once (NOT recommended)
```bash
git commit --no-verify
```

---

## Local linting without pre-commit

Same tools, manual invocation:

```bash
# Backend (Ruff)
cd backend && ruff check .

# Frontend (ESLint — same rules as `yarn build`)
cd frontend && yarn eslint src/ --quiet
```

Both should print zero errors on a clean checkout.

---

## Why we don't use the "code quality report" tool

The external tool that auto-generates Code Quality Reports has been wrong on:

- **Undefined-variable false positives** (it can't trace `try/except` returns)
- **`is`-vs-`==` for booleans** that don't exist in the codebase
- **"Insecure localStorage"** for non-sensitive flags (auth tokens are in
  httpOnly cookies, where they belong)
- **"Missing hook dependencies"** for hooks that have correct dependencies
- **"Empty catch blocks"** that have explanatory comments inside them

We use Ruff + ESLint because they're the tools the wider Python / React
ecosystem trusts. If the external tool disagrees, it's the one that's wrong.
