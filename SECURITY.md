# Security

DevOS treats **all repository content as untrusted input**. The analysis
pipeline is designed so that ingesting a hostile repository cannot compromise
the DevOS host, leak secrets, or execute attacker-controlled code.

## Threat model

- A connected repository may contain malicious code, symlinks, path-traversal
  filenames, extremely large or deeply nested files, or content crafted to
  exploit a parser.
- A user may attempt to connect a repository they do not have access to.
- API inputs may be malformed or malicious.

## Controls

### No code execution

The parser is **fully static**. DevOS never runs, imports, or `exec`s
repository code. Python files are parsed with the standard-library `ast` module
(parse-only); other languages use Tree-sitter grammars. Build scripts, hooks,
and `setup.py` are read as text, never executed.

### Sandboxed clone + path traversal protection

Each analysis clones into a dedicated working directory. Every file path is
resolved and checked to be inside that directory before it is opened
(`is_within_base` guard). Symlinks are not followed out of the sandbox. File
size and count limits bound resource usage.

### Safe subprocess execution

Git is invoked with argument lists (never a shell string), fixed executables,
and no interpolation of untrusted data into shell commands. Timeouts bound
execution.

### Authentication and access control

- GitHub OAuth authenticates users.
- Access tokens are stored **server-side only** and never sent to the frontend.
- Before any analysis, DevOS verifies the authenticated user can access the
  target repository via the GitHub API.
- Sessions are server-side and use signed, HTTP-only cookies.

### Input validation

All request bodies and query parameters are validated with Pydantic. Invalid
input returns `422` with structured errors. IDs are validated before database
lookups.

### Secrets handling

Secrets (OAuth client secret, DB credentials, session secret) come only from
environment variables and are never logged or returned to clients. `.env` is
git-ignored; `.env.example` documents the required keys without values.

### Rate limiting

API endpoints, and especially analysis triggers, are rate limited per user to
prevent abuse and resource exhaustion.

## Reporting a vulnerability

Please open a private security advisory or contact the maintainers directly
rather than filing a public issue.
