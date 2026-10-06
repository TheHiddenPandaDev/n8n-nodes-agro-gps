# n8n-nodes-agro-gps

n8n community node for [Agro GPS](https://agrogps.eu), the digital farm diary.

## Credentials

**Agro GPS API**: an API key (`agk_…`) from the Agro GPS app, **Settings > API and webhooks**. A read key lists farms and fields; a write key also registers operations, creates fields and runs the trigger.

## Agro GPS node

| Resource | Operations |
| --- | --- |
| Operation | Register (treatment, fertilizing, harvest, irrigation and 12 more types) |
| Field | Get Many, Create (from [lat, lng] points or GeoJSON) |
| Farm | Get Many |
| Plant Protection Product | Get (by registration number, optionally for one crop), Search (by name). No key needed |

Products come from 30 official European registers. The node can be used as an AI agent tool.

## Agro GPS Trigger

Starts a workflow when an operation is registered or reviewed by an advisor. Activating the workflow registers a webhook in Agro GPS with your write key; deactivating it removes it. Every delivery is checked against its HMAC-SHA256 signature and rejected if older than the configured age. The n8n instance must be reachable over public HTTPS.

## Make

`make-app/` holds the definitions of the Agro GPS app for Make (connection, modules, instant trigger) and `make-app/scenarios/` the test scenarios.

## Development

```bash
npm ci
npm run lint
npm test
npm run build
```

## Releasing

No npm token is stored anywhere. Publishing uses npm trusted publishing (OIDC) with provenance.

1. First publish, done manually by the owner (security key required): `RELEASE_MODE=true npm publish --access public`.
2. On npmjs.com, add a Trusted Publisher for the package: GitHub Actions, organization `TheHiddenPandaDev`, repository `n8n-nodes-agro-gps`, workflow `publish.yml`, environment empty.
3. From then on, pushing a version tag (`x.y.z`) runs `.github/workflows/publish.yml`, which stages the version with provenance. The owner approves it on npmjs.com under Staged Packages.

## License

[MIT](LICENSE.md)
