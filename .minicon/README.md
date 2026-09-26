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
