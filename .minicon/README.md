# Minicon-Fork von Paperclip

Dieser Fork trägt einen kleinen Patch auf Paperclip-Releases, bis er upstream gemergt ist.

| Datei | Zweck |
|---|---|
| `.minicon/base-tag` | Upstream-Release, auf dem `minicon/main` aufsetzt |
| `.github/workflows/minicon-build.yml` | baut `ghcr.io/minicon-eg/paperclip` |
| `.github/workflows/minicon-upstream-sync.yml` | täglich: neues Upstream-Release → Patch rebasen → testen → bauen |

## Patch

- **OIDC-Anmeldung für Board-Nutzer** (upstream [#3028](https://github.com/paperclipai/paperclip/issues/3028)):
  `server/src/auth/oidc.ts`, Einhängung in `server/src/auth/better-auth.ts`, `authSso` in `/api/health`,
  Knopf auf der Anmeldeseite. Gesteuert über `PAPERCLIP_OIDC_*`, siehe Kopf von `oidc.ts`.

## Pflege

`minicon/main` = `<base-tag>` + Minicon-Commits. Der Sync-Workflow rebased die Minicon-Commits auf jedes neue
stabile Upstream-Release. Gelingt das nicht oder schlagen Tests fehl, öffnet er ein Issue mit Label
`upstream-sync`; der Pflege-Agent in Paperclip (CR Worker) übernimmt es.

Manuell:

```bash
git fetch upstream --tags
NEU=$(gh release view --repo paperclipai/paperclip --json tagName -q .tagName)
git rebase --onto "$NEU" "$(cat .minicon/base-tag)" minicon/main
echo "$NEU" > .minicon/base-tag && git commit -am "chore: auf $NEU"
```

Doku im Betrieb: BookStack, Buch *Paperclip – Agenten-Orchestrierung*.

Standard-Branch des Forks: `minicon/main` (dort laufen die Zeitpläne).

## Agenten-Sandbox (Minicon-Patch)

- `Dockerfile`: installiert `bubblewrap`, damit `claude_local`/`codex_local` mit `filesystemScope: "workspace"`
  laufen können. Der Container braucht dafür das seccomp-Profil `seccomp-bwrap.json` (Docker-Standard plus
  `unshare`, `clone`, `clone3`, `mount`, `umount2`, `pivot_root`, `setns`) sowie
  `apparmor=unconfined` und `systempaths=unconfined`.
- `packages/adapter-utils/src/server-utils.ts` (`sanitizeInheritedPaperclipEnv`): `BETTER_AUTH_SECRET`,
  `DATABASE_URL` und alle in `PAPERCLIP_AGENT_ENV_DENYLIST` genannten Variablen werden nicht an
  Agentenprozesse vererbt. Upstream entfernt nur `PAPERCLIP_*`.
- `packages/adapter-utils/src/local-process-sandbox.ts`: `/bin`, `/sbin`, `/lib`, `/lib64` nicht zusätzlich
  einbinden – sie existieren in der Sandbox schon als Verweise auf `usr/*`. Upstream scheitert sonst auf
  Debian/usrmerge mit „Can't mount on symlink destination /bin“ (auch die eigenen bwrap-Tests,
  `PAPERCLIP_TEST_BWRAP=/usr/bin/bwrap`).
- `packages/adapter-utils/src/server-utils.ts` (`runChildProcess`): Fehlerbehandlung für stdin. Endet ein
  Agentenprozess vor dem Lesen seiner Eingabe, brachte das unbehandelte `EPIPE` den ganzen Server zum Absturz.
