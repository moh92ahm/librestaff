# Vercel deployment limitation

LibreStaff's Next.js application can be built on Vercel, but the application as shipped stores
uploaded media on the local filesystem. A serverless filesystem is not durable shared storage, so a
stock Vercel deployment is not recommended for production LibreStaff data.

To make a production Vercel deployment viable, first implement an object-storage media adapter that:

- writes uploads to private S3-compatible or equivalent object storage;
- performs authorization before reads or issues short-lived signed URLs;
- preserves the application's file type and size validation;
- deletes objects only through their owning business record; and
- supports backup, retention, and lifecycle requirements.

You would also need managed PostgreSQL, all variables from `.env.example`, a migration step outside
the request lifecycle, and scheduled invocations for any enabled jobs. Until an object-storage
adapter exists, choose Docker, a VPS, or a managed container host with a persistent volume.
