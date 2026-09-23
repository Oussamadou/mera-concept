import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://mera.seferstudio.com',
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
});
