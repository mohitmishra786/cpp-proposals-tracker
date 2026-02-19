# Contributing

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run linting
npm run lint

# Build for production
npm run build
```

## Code Style

### TypeScript

- Strict mode is enabled. No `any` types are permitted.
- Use explicit return types for exported functions.
- Define shared interfaces in `lib/types.ts`.
- Use Zod for API request validation.

### Python

- Use type hints for all function signatures.
- Use Pydantic models for data validation.
- Follow PEP 8 naming conventions.
- Use structlog for logging with keyword arguments.

## Pull Requests

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes
4. Run `npm run lint` and `npm run build` to verify
5. Submit a pull request

For significant changes, please open an issue first to discuss the approach.

## Project Structure

```
app/              Next.js App Router pages and API routes
components/       React components
lib/              Shared utilities and types
crawler/          Python crawler and ingestion pipeline
supabase/         Database schema
```
