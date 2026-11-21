// @ts-check
import { defineConfig } from 'astro/config';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

// Content is data, never code. Markdown is rendered, then any raw HTML
// (script tags, event handlers, iframes, javascript: links) is stripped by
// rehype-sanitize. The content validator also rejects raw HTML up front.
const sanitizeSchema = {
  ...defaultSchema,
  // Keep heading ids so in-page links work, but no "user-content-" prefix.
  clobberPrefix: '',
  attributes: {
    ...defaultSchema.attributes,
    h2: [...(defaultSchema.attributes?.h2 ?? []), 'id'],
    h3: [...(defaultSchema.attributes?.h3 ?? []), 'id'],
  },
};

export default defineConfig({
  site: 'https://safeclick.example.org',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  markdown: {
    rehypePlugins: [[rehypeSanitize, sanitizeSchema]],
  },
  // No telemetry is sent from the site itself. To disable Astro's CLI
  // telemetry on your machine, run: npx astro telemetry disable
});
