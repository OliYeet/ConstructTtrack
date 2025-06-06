// This file configures the initialization of Sentry on the browser/client side.
// The config you add here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Environment configuration
  environment: process.env.NODE_ENV || 'development',

  // Release configuration
  release: process.env.NEXT_PUBLIC_APP_VERSION || 'development',

  // Additional configuration for ConstructTrack
  beforeSend(event, _hint) {
    // Filter out development errors in production
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('Sentry event:', event);
    }

    // Add custom tags for ConstructTrack
    event.tags = {
      ...event.tags,
      component: 'web-client',
      platform: 'nextjs',
    };

    return event;
  },

  // Configure user context
  initialScope: {
    tags: {
      component: 'web-client',
    },
  },
});
