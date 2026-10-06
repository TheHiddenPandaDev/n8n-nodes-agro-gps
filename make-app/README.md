# Agro GPS

Digital farm diary for European farmers and advisors: register treatments, fertilizing, harvests and other operations, keep your fields, and check plant protection products against 30 official European registers.

## Connection

Create an API key in the Agro GPS app under **Settings > API and webhooks** and paste it into the Agro GPS connection. A read key lists farms and fields; a write key can also register operations, create fields and receive instant triggers. Product lookups need no special plan.

## Modules

- **Watch Operations** (instant): when an operation is registered or reviewed by an advisor. Needs a write key.
- **Register an Operation**: a treatment, fertilizing, harvest or any other diary entry. Reuse the Operation ID to avoid duplicates.
- **List Fields**: the fields of a farm with crop, surface and outline.
- **Create a Field**: a field from an outline of [latitude, longitude] points.
- **List Farms**: the farms the key can access.
- **Get a Plant Protection Product**: a product by registration number with its authorised uses, doses, safety days and conditions of use, optionally for one crop.
- **Search Plant Protection Products**: products by name in a country register.
- **Make an API Call**: any other endpoint of the Agro GPS API.
