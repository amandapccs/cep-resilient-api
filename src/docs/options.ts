import type { ApiReferenceConfiguration } from '@scalar/express-api-reference';

export const swaggerOptions = {
  theme: 'alternate',
  pageTitle: 'CEP Resilient API - Docs',
  customCss: `
  .dark-mode, .t-doc__sidebar {
    --scalar-color-blue: #bac676;
    --scalar-color-green: #bac676;
  }
  `,
} satisfies Partial<ApiReferenceConfiguration>;
