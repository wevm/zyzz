# POC validation

Verified on 2026-09-07 with Node 24.19.0, pnpm 11.19.0, TypeScript 5.9.3, Vite 8.2.2, and Vitest 5.0.0.

| Check                | Result                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `pnpm check:types`   | Pass, including negative type fixtures and `expectTypeOf` assertions                            |
| `pnpm test`          | 29 behavioral tests pass across 4 colocated suites                                              |
| `pnpm check`         | Formatting passes                                                                               |
| `pnpm build`         | ESM, source maps, and package declarations emit                                                 |
| `pnpm build:example` | Production Vite build passes; CSS asset extracted                                               |
| `pnpm build:library` | ESM, declarations, and stylesheet emit; repeated build passes                                   |
| Dev CSS update       | Real HTTP dev-server request returns updated CSS after a watched source edit                    |
| Dev style removal    | Removing the last css call clears the virtual CSS module                                        |
| Runtime footprint    | Production fixture has no typestyle import, macro, or runtime guard                             |
| Failure behavior     | Dynamic expressions are rejected without execution; invalid library types preserve prior output |
| Rebuild ownership    | Obsolete generated modules/declarations are removed; unrelated files remain                     |
| `git diff --check`   | Pass                                                                                            |

The demo production output is 2.55 kB JavaScript (1.41 kB gzip) and 8.54 kB CSS (1.77 kB gzip), including example font-face declarations; font binaries are separate. These are fixture observations, not a Tailwind/StyleX benchmark or general bundle-size claim.

Compiler and dev-server fixtures exercise the real adapters. A real-browser computed-style/visual audit, framework Fast Refresh state retention, Vite 7, SSR, P3 enhancement, and external tarball consumer compatibility remain planned follow-ups.

The repository is `https://github.com/wevm/typestyle`. GitHub reports private visibility and push access. The package, CLI, Vite integration, imports, and docs use the `typestyle` name.
