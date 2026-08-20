# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Security labs

Isolated, synthetic training scenarios. Vulnerable behaviour is scoped to
`/api/v1/lab/*` only; production `/api/v1` endpoints stay secure.

| Phase | Scenario | Route | Docs |
| --- | --- | --- | --- |
| 3 | API1:2023 — Broken Object Level Authorization | `/lab/bola` | [docs](docs/security-labs/api1-bola.md) |
| 4 | API5:2023 — Broken Function Level Authorization | `/lab/bfla` | [docs](docs/security-labs/api5-bfla.md) |
| 5 | API3:2023 — Broken Object Property Level Authorization | `/lab/bopla` | [docs](docs/security-labs/api3-bopla.md) |
| 6 | API2:2023 — Broken Authentication | `/lab/broken-auth` | [docs](docs/security-labs/api2-broken-auth.md) |

Automated checks live in `tests/security-labs/`:

```sh
set -a && . ./.env && set +a
python3 tests/security-labs/api1_bola_test.py
python3 tests/security-labs/api5_bfla_test.py
python3 tests/security-labs/api3_bopla_test.py
python3 tests/security-labs/api2_broken_auth_test.py
```
