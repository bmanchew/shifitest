URL: https://docs.didit.me/identity-verification/full-flow
---
🎉 Unlimited Free KYC - Forever!!

Identity Verification

Full Flow

## Didit Identity Verification API Full Flow [Permalink for this section](https://docs.didit.me/identity-verification/full-flow\#didit-identity-verification-api-full-flow)

The Didit Identity Verification API operates through a session-based mechanism involving several steps outlined below.

### Retrieve Credentials [Permalink for this section](https://docs.didit.me/identity-verification/full-flow\#retrieve-credentials)

Before running the application, set up some environment variables:

- Visit [Didit Business Console (opens in a new tab)](https://business.didit.me/) to obtain your `CLIENT_ID`, `CLIENT_SECRET`, and `WEBHOOK_SECRET_KEY` for handling webhooks.
- Configure `WEBHOOK_URL` in the application's advanced settings. For development purposes, you might use:



```nx-border-black nx-border-opacity-[0.04] nx-bg-opacity-[0.03] nx-bg-black nx-break-words nx-rounded-md nx-border nx-py-0.5 nx-px-[.25em] nx-text-[.9em] dark:nx-border-white/10 dark:nx-bg-white/10
WEBHOOK_URL=https://yourapp.com/api/webhook
```

- In your `.env` file, fill in the environment variables obtained from the step above. Your `.env` file will look something like this:



```nx-border-black nx-border-opacity-[0.04] nx-bg-opacity-[0.03] nx-bg-black nx-break-words nx-rounded-md nx-border nx-py-0.5 nx-px-[.25em] nx-text-[.9em] dark:nx-border-white/10 dark:nx-bg-white/10
CLIENT_ID=<YourClientId>
CLIENT_SECRET=<YourClientSecret>
WEBHOOK_SECRET_KEY=<YourWebhookSecretKey>
```


### Client Authentication [Permalink for this section](https://docs.didit.me/identity-verification/full-flow\#client-authentication)

To call the Verification endpoints, provide the client `access_token` in the Authorization header as Bearer `${access_token}`.

Refer to the [Client Authentication](https://docs.didit.me/identity-verification/api-reference/authentication) section for detailed information and code examples.

### Creating Verification Session [Permalink for this section](https://docs.didit.me/identity-verification/full-flow\#creating-verification-session)

After obtaining a valid client `access_token`, you can call the verification service `/v1/session/` endpoint.

Refer to the [Create Session](https://docs.didit.me/identity-verification/api-reference/create-session) section for detailed information and code examples.

### Webhook for Verification Status [Permalink for this section](https://docs.didit.me/identity-verification/full-flow\#webhook-for-verification-status)

Webhooks are used to keep you notified of any status changes for the verification sessions you have created.

The webhooks are sent to the webhook URL configured on the business dashboard. To ensure that the webhook is from Didit, you need to verify the signature sent in the `x-signature` field of the header using the webhook secret obtained from the business dashboard.

Refer to the [Webhooks](https://docs.didit.me/identity-verification/webhooks) section for detailed information and code examples on how to handle webhooks and verify their signatures.

### (Optional) Retrieving Verification Results through API [Permalink for this section](https://docs.didit.me/identity-verification/full-flow\#optional-retrieving-verification-results-through-api)

If you want to fetch verification results through the API, you can do so by calling the `/v1/session/{sessionId}/decision/` endpoint. The recommended way of receiving verification results is through webhooks (step 4).

Refer to the [Retrieve Session](https://docs.didit.me/identity-verification/api-reference/retrieve-session) section for detailed information and code examples.

Last updated on December 8, 2024

[Supported Languages](https://docs.didit.me/identity-verification/supported-languages "Supported Languages") [Demos](https://docs.didit.me/identity-verification/demos "Demos")