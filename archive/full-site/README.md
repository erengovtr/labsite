# Archived: full marketing site + verification (v1)

Snapshot of the complete SideChain Analytics site concept (home page with ordering,
capabilities, panel, report, method, about, FAQ, contact — plus the /verify page and
/admin panel), styled after sidechainanalytics.com.

The same state is tagged in git as `v1-full-site`.

## Restore

The server code in `server/` is shared and unchanged. To serve this version instead of
the current one, either:

- point the server at this folder: replace the top-level `public/` with `archive/full-site/public/`, or
- check out the tag: `git checkout v1-full-site`
