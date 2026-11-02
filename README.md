# ResumeMatch

Upload a resume (PDF/DOCX), extract skills in the browser, and rank live remote software jobs by how many of each job's required skills you have.

- **Privacy:** the resume is parsed locally and never uploaded.
- **Sources:** Remotive, Arbeitnow, Remote OK (no API keys needed).
- **Stack:** React, TypeScript, Vite, Tailwind CSS v4, pdf.js, mammoth.

## Run

```bash
npm install
npm run dev
```

## Limitations
- Matching is keyword-based, so it can miss synonyms and context. Scores are a guide, not a verdict.
- Each source has its own rate limits and attribution rules; results are cached for an hour and every job links back to its original listing.
