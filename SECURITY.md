# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it by emailing the maintainer directly. Do not open a public issue.

Include the following information:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if available)

You will receive a response within 48 hours. Valid vulnerabilities will be acknowledged and addressed promptly.

## Security Considerations

### API Keys

This application requires several API keys to function:

- **Supabase keys**: The anon key is safe for client-side use. The service role key must remain server-side only.
- **Groq/HuggingFace keys**: Used for LLM inference and embeddings. Keep these in environment variables only.
- **Upstash Redis credentials**: Used for rate limiting. Should be kept secure.

Never commit API keys to the repository. The `.gitignore` is configured to exclude `.env` and `.env.local` files.

### Row-Level Security

Supabase row-level security is enabled on all tables:

- Public read access is allowed on `emails`, `threads`, and `authors`
- Write operations require the service role key
- Client-side requests use the anon key and cannot modify data

### Rate Limiting

The `/api/ask` endpoint is rate-limited to prevent abuse:

- 10 requests per IP address per hour
- Implemented via Upstash Redis
- Returns 429 status with retry headers when exceeded

### Input Validation

All API endpoints use Zod schemas for request validation. Invalid input returns a 400 status with error details. No user input is executed or evaluated directly.

## Best Practices

When deploying this application:

1. Use environment variables for all secrets
2. Enable HTTPS in production
3. Keep dependencies updated
4. Monitor API usage for anomalies
5. Rotate API keys periodically
