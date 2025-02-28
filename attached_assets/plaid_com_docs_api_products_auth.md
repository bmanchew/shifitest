URL: https://plaid.com/docs/api/products/auth/
---
# Auth

#### API reference for Auth endpoints and webhooks

Retrieve bank account information to set up electronic funds transfers, such as ACH payments in the US, EFT payments in Canada, BACS payments in the UK, and IBAN / SIC payments in the EU.

For how-to guidance, see the [Auth documentation](https://plaid.com/docs/auth/).

| Endpoints |  |
| --- | --- |
| [`/auth/get`](https://plaid.com/docs/api/products/auth/#authget) | Fetch account information |
| [`/bank_transfer/event/list`](https://plaid.com/docs/api/products/auth/#bank_transfereventlist) | Search for updates on micro-deposit verification statuses based on filter criteria |
| [`/bank_transfer/event/sync`](https://plaid.com/docs/api/products/auth/#bank_transfereventsync) | Get updates on micro-deposit verification statuses using a cursor |

| See also |  |
| --- | --- |
| [`/processor/token/create`](https://plaid.com/docs/api/processors/#processortokencreate) | Create a token for using Auth with a processing partner |
| [`/sandbox/processor_token/create`](https://plaid.com/docs/api/sandbox/#sandboxprocessor_tokencreate) | Create a token for testing Auth with a processing partner |
| [`/processor/stripe/bank_account_token/create`](https://plaid.com/docs/api/processors/#processorstripebank_account_tokencreate) | Create a token for using Auth with Stripe as a processing partner |
| [`/sandbox/item/set_verification_status`](https://plaid.com/docs/api/sandbox/#sandboxitemset_verification_status) | Change a Sandbox Item's micro-deposit verification status |

| Webhooks |  |
| --- | --- |
| [`DEFAULT_UPDATE`](https://plaid.com/docs/api/products/auth/#default_update) | Item has account(s) with updated Auth data |
| [`AUTOMATICALLY_VERIFIED`](https://plaid.com/docs/api/products/auth/#automatically_verified) | Item has been verified |
| [`VERIFICATION_EXPIRED`](https://plaid.com/docs/api/products/auth/#verification_expired) | Item verification has failed |
| [`BANK_TRANSFERS_EVENTS_UPDATE`](https://plaid.com/docs/api/products/auth/#bank_transfers_events_update) | New micro-deposit verification events available |
| [`SMS_MICRODEPOSITS_VERIFICATION`](https://plaid.com/docs/api/products/auth/#sms_microdeposits_verification) | Text message verification status has changed |

[**Endpoints**](https://plaid.com/docs/api/products/auth/#endpoints) [**`/auth/get`**](https://plaid.com/docs/api/products/auth/#authget)

[**Retrieve auth data**](https://plaid.com/docs/api/products/auth/#retrieve-auth-data)

The [`/auth/get`](https://plaid.com/docs/api/products/auth/#authget) endpoint returns the bank account and bank identification numbers (such as routing numbers, for US accounts) associated with an Item's checking, savings, and cash management accounts, along with high-level account data and balances when available.

Versioning note: In API version 2017-03-08, the schema of the `numbers` object returned by this endpoint is substantially different. For details, see [Plaid API versioning](https://plaid.com/docs/api/versioning/#version-2018-05-22).

auth/get

**Request fields** Collapse all

Your Plaid API `client_id`. The `client_id` is required and may be provided either in the `PLAID-CLIENT-ID` header or as part of a request body.

Your Plaid API `secret`. The `secret` is required and may be provided either in the `PLAID-SECRET` header or as part of a request body.

The access token associated with the Item data is being requested for.

An optional object to filter `/auth/get` results.

Hide object

A list of `account_ids` to retrieve for the Item.
Note: An error will be returned if a provided `account_id` is not associated with the Item.

Select group for content switcher

Current librariesLegacy libraries

/auth/get

Node

Select Language

- Curl
- Node
- Python
- Ruby
- Java
- Go

Copy

```CodeBlock-module_code__18Tbe

1const request: AuthGetRequest = {
2  access_token: accessToken,
3};
4try {
5  const response = await plaidClient.authGet(request);
6  const accountData = response.data.accounts;
7  const numbers = response.data.numbers;
8} catch (error) {
9  // handle error
10}
```

auth/get

**Response fields** and example

Collapse all

The `accounts` for which numbers are being retrieved.

Hide object

Plaid’s unique identifier for the account. This value will not change unless Plaid can't reconcile the account with the data returned by the financial institution. This may occur, for example, when the name of the account changes. If this happens a new `account_id` will be assigned to the account.

The `account_id` can also change if the `access_token` is deleted and the same credentials that were used to generate that `access_token` are used to generate a new `access_token` on a later date. In that case, the new `account_id` will be different from the old `account_id`.

If an account with a specific `account_id` disappears instead of changing, the account is likely closed. Closed accounts are not returned by the Plaid API.

Like all Plaid identifiers, the `account_id` is case sensitive.

A set of fields describing the balance for an account. Balance information may be cached unless the balance object was returned by `/accounts/balance/get`.

Hide object

The amount of funds available to be withdrawn from the account, as determined by the financial institution.

For `credit`-type accounts, the `available` balance typically equals the `limit` less the `current` balance, less any pending outflows plus any pending inflows.

For `depository`-type accounts, the `available` balance typically equals the `current` balance less any pending outflows plus any pending inflows. For `depository`-type accounts, the `available` balance does not include the overdraft limit.

For `investment`-type accounts (or `brokerage`-type accounts for API versions 2018-05-22 and earlier), the `available` balance is the total cash available to withdraw as presented by the institution.

Note that not all institutions calculate the `available` balance. In the event that `available` balance is unavailable, Plaid will return an `available` balance value of `null`.

Available balance may be cached and is not guaranteed to be up-to-date in realtime unless the value was returned by `/accounts/balance/get`.

If `current` is `null` this field is guaranteed not to be `null`.

Format: `double`

The total amount of funds in or owed by the account.

For `credit`-type accounts, a positive balance indicates the amount owed; a negative amount indicates the lender owing the account holder.

For `loan`-type accounts, the current balance is the principal remaining on the loan, except in the case of student loan accounts at Sallie Mae ( `ins_116944`). For Sallie Mae student loans, the account's balance includes both principal and any outstanding interest. Similar to `credit`-type accounts, a positive balance is typically expected, while a negative amount indicates the lender owing the account holder.

For `investment`-type accounts (or `brokerage`-type accounts for API versions 2018-05-22 and earlier), the current balance is the total value of assets as presented by the institution.

Note that balance information may be cached unless the value was returned by `/accounts/balance/get`; if the Item is enabled for Transactions, the balance will be at least as recent as the most recent Transaction update. If you require realtime balance information, use the `available` balance as provided by `/accounts/balance/get`.

When returned by `/accounts/balance/get`, this field may be `null`. When this happens, `available` is guaranteed not to be `null`.

Format: `double`

For `credit`-type accounts, this represents the credit limit.

For `depository`-type accounts, this represents the pre-arranged overdraft limit, which is common for current (checking) accounts in Europe.

In North America, this field is typically only available for `credit`-type accounts.

Format: `double`

The ISO-4217 currency code of the balance. Always null if `unofficial_currency_code` is non-null.

The unofficial currency code associated with the balance. Always null if `iso_currency_code` is non-null. Unofficial currency codes are used for currencies that do not have official ISO currency codes, such as cryptocurrencies and the currencies of certain countries.

See the [currency code schema](https://plaid.com/docs/api/accounts#currency-code-schema) for a full listing of supported `unofficial_currency_code` s.

Timestamp in [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) format ( `YYYY-MM-DDTHH:mm:ssZ`) indicating the oldest acceptable balance when making a request to `/accounts/balance/get`.

This field is only used and expected when the institution is `ins_128026` (Capital One) and the Item contains one or more accounts with a non-depository account type, in which case a value must be provided or an `INVALID_REQUEST` error with the code of `INVALID_FIELD` will be returned. For Capital One depository accounts as well as all other account types on all other institutions, this field is ignored. See [account type schema](https://plaid.com/docs/api/accounts/#account-type-schema) for a full list of account types.

If the balance that is pulled is older than the given timestamp for Items with this field required, an `INVALID_REQUEST` error with the code of `LAST_UPDATED_DATETIME_OUT_OF_RANGE` will be returned with the most recent timestamp for the requested account contained in the response.

Format: `date-time`

The last 2-4 alphanumeric characters of either the account’s displayed mask or the account’s official account number. Note that the mask may be non-unique between an Item’s accounts.

The name of the account, either assigned by the user or by the financial institution itself

The official name of the account as given by the financial institution

`investment:` Investment account. In API versions 2018-05-22 and earlier, this type is called `brokerage` instead.

`credit:` Credit card

`depository:` Depository account

`loan:` Loan account

`other:` Non-specified account type

See the [Account type schema](https://plaid.com/docs/api/accounts#account-type-schema) for a full listing of account types and corresponding subtypes.

Possible values: `investment`, `credit`, `depository`, `loan`, `brokerage`, `other`

See the [Account type schema](https://plaid.com/docs/api/accounts/#account-type-schema) for a full listing of account types and corresponding subtypes.

Possible values: `401a`, `401k`, `403B`, `457b`, `529`, `auto`, `brokerage`, `business`, `cash isa`, `cash management`, `cd`, `checking`, `commercial`, `construction`, `consumer`, `credit card`, `crypto exchange`, `ebt`, `education savings account`, `fixed annuity`, `gic`, `health reimbursement arrangement`, `home equity`, `hsa`, `isa`, `ira`, `keogh`, `lif`, `life insurance`, `line of credit`, `lira`, `loan`, `lrif`, `lrsp`, `money market`, `mortgage`, `mutual fund`, `non-custodial wallet`, `non-taxable brokerage account`, `other`, `other insurance`, `other annuity`, `overdraft`, `paypal`, `payroll`, `pension`, `prepaid`, `prif`, `profit sharing plan`, `rdsp`, `resp`, `retirement`, `rlif`, `roth`, `roth 401k`, `rrif`, `rrsp`, `sarsep`, `savings`, `sep ira`, `simple ira`, `sipp`, `stock plan`, `student`, `thrift savings plan`, `tfsa`, `trust`, `ugma`, `utma`, `variable annuity`

The current verification status of an Auth Item initiated through micro-deposits or database verification. Returned for Auth Items only.

`pending_automatic_verification`: The Item is pending automatic verification

`pending_manual_verification`: The Item is pending manual micro-deposit verification. Items remain in this state until the user successfully verifies the micro-deposit.

`automatically_verified`: The Item has successfully been automatically verified

`manually_verified`: The Item has successfully been manually verified

`verification_expired`: Plaid was unable to automatically verify the deposit within 7 calendar days and will no longer attempt to validate the Item. Users may retry by submitting their information again through Link.

`verification_failed`: The Item failed manual micro-deposit verification because the user exhausted all 3 verification attempts. Users may retry by submitting their information again through Link.

`database_matched`: The Item has successfully been verified using Plaid's data sources. Only returned for Auth Items created via Database Match.

`database_insights_pass`: The Item's numbers have been verified using Plaid's data sources and have strong signal for being valid. Only returned for Auth Items created via Database Insights. Note: Database Insights is currently a beta feature, please contact your account manager for more information.

`database_insights_pass_with_caution`: The Item's numbers have been verified using Plaid's data sources and have some signal for being valid. Only returned for Auth Items created via Database Insights. Note: Database Insights is currently a beta feature, please contact your account manager for more information.

`database_insights_fail`: The Item's numbers have been verified using Plaid's data sources and have signal for being invalid and/or have no signal for being valid. Only returned for Auth Items created via Database Insights. Note: Database Insights is currently a beta feature, please contact your account manager for more information.

Possible values: `automatically_verified`, `pending_automatic_verification`, `pending_manual_verification`, `manually_verified`, `verification_expired`, `verification_failed`, `database_matched`, `database_insights_pass`, `database_insights_pass_with_caution`, `database_insights_fail`

Insights from performing database verification for the account. Only returned for Auth Items created via Database Insights.

Hide object

Status information about the account and routing number in the Plaid network.

Hide object

Indicates whether we found at least one matching account for the ACH account and routing number.

Indicates if at least one matching account for the ACH account and routing number is already verified.

Information about known ACH returns for the account and routing number.

Hide object

Indicates whether Plaid's data sources include a known administrative ACH return for account and routing number.

Indicator of account number format validity for institution.

`valid`: indicates that the account number has a correct format for the institution.

`invalid`: indicates that the account number has an incorrect format for the institution.

`unknown`: indicates that there was not enough information to determine whether the format is correct for the institution.

Possible values: `valid`, `invalid`, `unknown`

A unique and persistent identifier for accounts that can be used to trace multiple instances of the same account across different Items for depository accounts. This field is currently supported only for Items at institutions that use Tokenized Account Numbers (i.e., Chase and PNC). Because these accounts have a different account number each time they are linked, this field may be used instead of the account number to uniquely identify an account across multiple Items for payments use cases, helping to reduce duplicate Items or attempted fraud. In Sandbox, this field is populated for TAN-based institutions ( `ins_56`, `ins_13`) as well as the OAuth Sandbox institution ( `ins_127287`); in Production, it will only be populated for accounts at applicable institutions.

Indicates the account's categorization as either a personal or a business account. This field is currently in beta; to request access, contact your account manager.

Possible values: `business`, `personal`, `unrecognized`

An object containing identifying numbers used for making electronic transfers to and from the `accounts`. The identifying number type (ACH, EFT, IBAN, or BACS) used will depend on the country of the account. An account may have more than one number type. If a particular identifying number type is not used by any `accounts` for which data has been requested, the array for that type will be empty.

Hide object

An array of ACH numbers identifying accounts.

Hide object

The Plaid account ID associated with the account numbers

The ACH account number for the account.

At certain institutions, including Chase and PNC, you will receive "tokenized" routing and account numbers, which are not the user's actual account and routing numbers. For important details on how this may impact your integration and on how to avoid fraud, user confusion, and ACH returns, see [Tokenized account numbers](https://plaid.com/docs/auth/#tokenized-account-numbers).

Indicates whether the account number is tokenized by the institution. For important details on how tokenized account numbers may impact your integration, see [Tokenized account numbers](https://plaid.com/docs/auth/#tokenized-account-numbers).

The ACH routing number for the account. This may be a tokenized routing number. For more information, see [Tokenized account numbers](https://plaid.com/docs/auth/#tokenized-account-numbers).

The wire transfer routing number for the account. This field is only populated if the institution is known to use a separate wire transfer routing number. Many institutions do not have a separate wire routing number and use the ACH routing number for wires instead. It is recommended to have the end user manually confirm their wire routing number before sending any wires to their account, especially if this field is `null`.

An array of EFT numbers identifying accounts.

Hide object

The Plaid account ID associated with the account numbers

The EFT account number for the account

The EFT institution number for the account

The EFT branch number for the account

An array of IBAN numbers identifying accounts.

Hide object

The Plaid account ID associated with the account numbers

The International Bank Account Number (IBAN) for the account

The Bank Identifier Code (BIC) for the account

An array of BACS numbers identifying accounts.

Hide object

The Plaid account ID associated with the account numbers

The BACS account number for the account

The BACS sort code for the account

Metadata about the Item.

Hide object

The Plaid Item ID. The `item_id` is always unique; linking the same account at the same institution twice will result in two Items with different `item_id` values. Like all Plaid identifiers, the `item_id` is case-sensitive.

The Plaid Institution ID associated with the Item. Field is `null` for Items created without an institution connection, such as Items created via Same Day Micro-deposits.

The name of the institution associated with the Item. Field is `null` for Items created without an institution connection, such as Items created via Same Day Micro-deposits.

The URL registered to receive webhooks for the Item.

The method used to populate Auth data for the Item. This field is only populated for Items that have had Auth numbers data set on at least one of its accounts, and will be `null` otherwise. For info about the various flows, see our [Auth coverage documentation](https://plaid.com/docs/auth/coverage/).

`INSTANT_AUTH`: The Item's Auth data was provided directly by the user's institution connection.

`INSTANT_MATCH`: The Item's Auth data was provided via the Instant Match fallback flow.

`AUTOMATED_MICRODEPOSITS`: The Item's Auth data was provided via the Automated Micro-deposits flow.

`SAME_DAY_MICRODEPOSITS`: The Item's Auth data was provided via the Same Day Micro-deposits flow.

`INSTANT_MICRODEPOSITS`: The Item's Auth data was provided via the Instant Micro-deposits flow.

`DATABASE_MATCH`: The Item's Auth data was provided via the Database Match flow.

`DATABASE_INSIGHTS`: The Item's Auth data was provided via the Database Insights flow.

`TRANSFER_MIGRATED`: The Item's Auth data was provided via [`/transfer/migrate_account`](https://plaid.com/docs/api/products/transfer/account-linking/#migrate-account-into-transfers).

`INVESTMENTS_FALLBACK`: The Item's Auth data for Investments Move was provided via a [fallback flow](https://plaid.com/docs/investments-move/#fallback-flows).

Possible values: `INSTANT_AUTH`, `INSTANT_MATCH`, `AUTOMATED_MICRODEPOSITS`, `SAME_DAY_MICRODEPOSITS`, `INSTANT_MICRODEPOSITS`, `DATABASE_MATCH`, `DATABASE_INSIGHTS`, `TRANSFER_MIGRATED`, `INVESTMENTS_FALLBACK`

Errors are identified by `error_code` and categorized by `error_type`. Use these in preference to HTTP status codes to identify and handle specific errors. HTTP status codes are set and provide the broadest categorization of errors: 4xx codes are for developer- or user-related errors, and 5xx codes are for Plaid-related errors, and the status will be 2xx in non-error cases. An Item with a non- `null` error object will only be part of an API response when calling `/item/get` to view Item status. Otherwise, error fields will be `null` if no error has occurred; if an error has occurred, an error code will be returned instead.

Hide object

A broad categorization of the error. Safe for programmatic use.

Possible values: `INVALID_REQUEST`, `INVALID_RESULT`, `INVALID_INPUT`, `INSTITUTION_ERROR`, `RATE_LIMIT_EXCEEDED`, `API_ERROR`, `ITEM_ERROR`, `ASSET_REPORT_ERROR`, `RECAPTCHA_ERROR`, `OAUTH_ERROR`, `PAYMENT_ERROR`, `BANK_TRANSFER_ERROR`, `INCOME_VERIFICATION_ERROR`, `MICRODEPOSITS_ERROR`, `SANDBOX_ERROR`, `PARTNER_ERROR`, `TRANSACTIONS_ERROR`, `TRANSACTION_ERROR`, `TRANSFER_ERROR`

The particular error code. Safe for programmatic use.

The specific reason for the error code. Currently, reasons are only supported OAuth-based item errors; `null` will be returned otherwise. Safe for programmatic use.

Possible values:
`OAUTH_INVALID_TOKEN`: The user’s OAuth connection to this institution has been invalidated.

`OAUTH_CONSENT_EXPIRED`: The user's access consent for this OAuth connection to this institution has expired.

`OAUTH_USER_REVOKED`: The user’s OAuth connection to this institution is invalid because the user revoked their connection.

A developer-friendly representation of the error code. This may change over time and is not safe for programmatic use.

A user-friendly representation of the error code. `null` if the error is not related to user action.

This may change over time and is not safe for programmatic use.

A unique ID identifying the request, to be used for troubleshooting purposes. This field will be omitted in errors provided by webhooks.

In this product, a request can pertain to more than one Item. If an error is returned for such a request, `causes` will return an array of errors containing a breakdown of these errors on the individual Item level, if any can be identified.

`causes` will only be provided for the `error_type` `ASSET_REPORT_ERROR`. `causes` will also not be populated inside an error nested within a `warning` object.

The HTTP status code associated with the error. This will only be returned in the response body when the error information is provided via a webhook.

The URL of a Plaid documentation page with more information about the error

Suggested steps for resolving the error

A list of products available for the Item that have not yet been accessed. The contents of this array will be mutually exclusive with `billed_products`.

Possible values: `assets`, `auth`, `balance`, `balance_plus`, `beacon`, `identity`, `identity_match`, `investments`, `investments_auth`, `liabilities`, `payment_initiation`, `identity_verification`, `transactions`, `credit_details`, `income`, `income_verification`, `standing_orders`, `transfer`, `employment`, `recurring_transactions`, `transactions_refresh`, `signal`, `statements`, `processor_payments`, `processor_identity`, `profile`, `cra_base_report`, `cra_income_insights`, `cra_partner_insights`, `cra_network_insights`, `cra_cashflow_insights`, `layer`, `pay_by_bank`

A list of products that have been billed for the Item. The contents of this array will be mutually exclusive with `available_products`. Note - `billed_products` is populated in all environments but only requests in Production are billed. Also note that products that are billed on a pay-per-call basis rather than a pay-per-Item basis, such as `balance`, will not appear here.

Possible values: `assets`, `auth`, `balance`, `balance_plus`, `beacon`, `identity`, `identity_match`, `investments`, `investments_auth`, `liabilities`, `payment_initiation`, `identity_verification`, `transactions`, `credit_details`, `income`, `income_verification`, `standing_orders`, `transfer`, `employment`, `recurring_transactions`, `transactions_refresh`, `signal`, `statements`, `processor_payments`, `processor_identity`, `profile`, `cra_base_report`, `cra_income_insights`, `cra_partner_insights`, `cra_network_insights`, `cra_cashflow_insights`, `layer`, `pay_by_bank`

A list of products added to the Item. In almost all cases, this will be the same as the `billed_products` field. For some products, it is possible for the product to be added to an Item but not yet billed (e.g. Assets, before `/asset_report/create` has been called, or Auth or Identity when added as Optional Products but before their endpoints have been called), in which case the product may appear in `products` but not in `billed_products`.

Possible values: `assets`, `auth`, `balance`, `balance_plus`, `beacon`, `identity`, `identity_match`, `investments`, `investments_auth`, `liabilities`, `payment_initiation`, `identity_verification`, `transactions`, `credit_details`, `income`, `income_verification`, `standing_orders`, `transfer`, `employment`, `recurring_transactions`, `transactions_refresh`, `signal`, `statements`, `processor_payments`, `processor_identity`, `profile`, `cra_base_report`, `cra_income_insights`, `cra_partner_insights`, `cra_network_insights`, `cra_cashflow_insights`, `layer`, `pay_by_bank`

A list of products that the user has consented to for the Item via [Data Transparency Messaging](https://plaid.com/docs/link/data-transparency-messaging-migration-guide). This will consist of all products where both of the following are true: the user has consented to the required data scopes for that product and you have Production access for that product.

Possible values: `assets`, `auth`, `balance`, `balance_plus`, `beacon`, `identity`, `identity_match`, `investments`, `investments_auth`, `liabilities`, `transactions`, `income`, `income_verification`, `transfer`, `employment`, `recurring_transactions`, `signal`, `statements`, `processor_payments`, `processor_identity`, `cra_base_report`, `cra_income_insights`, `cra_partner_insights`, `cra_cashflow_insights`, `layer`

The date and time at which the Item's access consent will expire, in [ISO 8601](https://wikipedia.org/wiki/ISO_8601) format. If the Item does not have consent expiration scheduled, this field will be `null`. Currently, only institutions in Europe and a small number of institutions in the US have expiring consent. Closer to the 1033 compliance deadline of April 1, 2026, expiration times will be populated more widely. For more details, see [Data Transparency Messaging consent expiration](https://plaid.com/docs/link/data-transparency-messaging-migration-guide/#consent-expiration-and-reauthorization.)

Format: `date-time`

Indicates whether an Item requires user interaction to be updated, which can be the case for Items with some forms of two-factor authentication.

`background` \- Item can be updated in the background

`user_present_required` \- Item requires user interaction to be updated

Possible values: `background`, `user_present_required`

A unique identifier for the request, which can be used for troubleshooting. This identifier, like all Plaid identifiers, is case sensitive.

API Object

Copy

```CodeBlock-module_code__18Tbe

1{
2  "accounts": [\
3    {\
4      "account_id": "vzeNDwK7KQIm4yEog683uElbp9GRLEFXGK98D",\
5      "balances": {\
6        "available": 100,\
7        "current": 110,\
8        "limit": null,\
9        "iso_currency_code": "USD",\
10        "unofficial_currency_code": null\
11      },\
12      "mask": "9606",\
13      "name": "Plaid Checking",\
14      "official_name": "Plaid Gold Checking",\
15      "subtype": "checking",\
16      "type": "depository"\
17    }\
18  ],
19  "numbers": {
20    "ach": [\
21      {\
22        "account": "9900009606",\
23        "account_id": "vzeNDwK7KQIm4yEog683uElbp9GRLEFXGK98D",\
24        "routing": "011401533",\
25        "wire_routing": "021000021"\
26      }\
27    ],
28    "eft": [\
29      {\
30        "account": "111122223333",\
31        "account_id": "vzeNDwK7KQIm4yEog683uElbp9GRLEFXGK98D",\
32        "institution": "021",\
33        "branch": "01140"\
34      }\
35    ],
36    "international": [\
37      {\
38        "account_id": "vzeNDwK7KQIm4yEog683uElbp9GRLEFXGK98D",\
39        "bic": "NWBKGB21",\
40        "iban": "GB29NWBK60161331926819"\
41      }\
42    ],
43    "bacs": [\
44      {\
45        "account": "31926819",\
46        "account_id": "vzeNDwK7KQIm4yEog683uElbp9GRLEFXGK98D",\
47        "sort_code": "601613"\
48      }\
49    ]
50  },
51  "item": {
52    "available_products": [\
53      "balance",\
54      "identity",\
55      "payment_initiation",\
56      "transactions"\
57    ],
58    "billed_products": [\
59      "assets",\
60      "auth"\
61    ],
62    "consent_expiration_time": null,
63    "error": null,
64    "institution_id": "ins_117650",
65    "institution_name": "Royal Bank of Plaid",
66    "item_id": "DWVAAPWq4RHGlEaNyGKRTAnPLaEmo8Cvq7na6",
67    "update_type": "background",
68    "webhook": "https://www.genericwebhookurl.com/webhook",
69    "auth_method": "INSTANT_AUTH"
70  },
71  "request_id": "m8MDnv9okwxFNBV"
72}
```

##### Was this helpful?

YesNo

[**`/bank_transfer/event/list`**](https://plaid.com/docs/api/products/auth/#bank_transfereventlist)

[**List bank transfer events**](https://plaid.com/docs/api/products/auth/#list-bank-transfer-events)

Use the [`/bank_transfer/event/list`](https://plaid.com/docs/api/products/auth/#bank_transfereventlist) endpoint to get a list of Plaid-initiated ACH or bank transfer events based on specified filter criteria. When using Auth with micro-deposit verification enabled, this endpoint can be used to fetch status updates on ACH micro-deposits. For more details, see [micro-deposit events](https://plaid.com/docs/auth/coverage/microdeposit-events/).

bank\_transfer/event/list

**Request fields**

Your Plaid API `client_id`. The `client_id` is required and may be provided either in the `PLAID-CLIENT-ID` header or as part of a request body.

Your Plaid API `secret`. The `secret` is required and may be provided either in the `PLAID-SECRET` header or as part of a request body.

The start datetime of bank transfers to list. This should be in RFC 3339 format (i.e. `2019-12-06T22:35:49Z`)

Format: `date-time`

The end datetime of bank transfers to list. This should be in RFC 3339 format (i.e. `2019-12-06T22:35:49Z`)

Format: `date-time`

Plaid’s unique identifier for a bank transfer.

The account ID to get events for all transactions to/from an account.

The type of bank transfer. This will be either `debit` or `credit`. A `debit` indicates a transfer of money into your origination account; a `credit` indicates a transfer of money out of your origination account.

Possible values: `debit`, `credit`, `null`

Filter events by event type.

Possible values: `pending`, `cancelled`, `failed`, `posted`, `reversed`

The maximum number of bank transfer events to return. If the number of events matching the above parameters is greater than `count`, the most recent events will be returned.

Default: `25`

Maximum: `25`

Minimum: `1`

The offset into the list of bank transfer events. When `count` =25 and `offset` =0, the first 25 events will be returned. When `count` =25 and `offset` =25, the next 25 bank transfer events will be returned.

Default: `0`

Minimum: `0`

The origination account ID to get events for transfers from a specific origination account.

Indicates the direction of the transfer: `outbound`: for API-initiated transfers
`inbound`: for payments received by the FBO account.

Possible values: `inbound`, `outbound`, `null`

Select group for content switcher

Current librariesLegacy libraries

Node

Select Language

- Curl
- Node
- Python
- Ruby
- Java
- Go

Copy

```CodeBlock-module_code__18Tbe

1const request: BankTransferEventListRequest = {
2  start_date: start_date,
3  end_date: end_date,
4  bank_transfer_id: bank_transfer_id,
5  account_id: account_id,
6  bank_transfer_type: bank_transfer_type,
7  event_types: event_types,
8  count: count,
9  offset: offset,
10  origination_account_id: origination_account_id,
11  direction: direction,
12};
13try {
14  const response = await plaidClient.bankTransferEventList(request);
15  const events = response.data.bank_transfer_events;
16  for (const event of events) {
17    // iterate through events
18  }
19} catch (error) {
20  // handle error
21}
```

bank\_transfer/event/list

**Response fields** and example

Collapse all

Hide object

Plaid’s unique identifier for this event. IDs are sequential unsigned 64-bit integers.

Minimum: `0`

The datetime when this event occurred. This will be of the form `2006-01-02T15:04:05Z`.

Format: `date-time`

The type of event that this bank transfer represents.

`pending`: A new transfer was created; it is in the pending state.

`cancelled`: The transfer was cancelled by the client.

`failed`: The transfer failed, no funds were moved.

`posted`: The transfer has been successfully submitted to the payment network.

`reversed`: A posted transfer was reversed.

Possible values: `pending`, `cancelled`, `failed`, `posted`, `reversed`

The account ID associated with the bank transfer.

Plaid’s unique identifier for a bank transfer.

The ID of the origination account that this balance belongs to.

The type of bank transfer. This will be either `debit` or `credit`. A `debit` indicates a transfer of money into the origination account; a `credit` indicates a transfer of money out of the origination account.

Possible values: `debit`, `credit`

The bank transfer amount.

The currency of the bank transfer amount.

The failure reason if the type of this transfer is `"failed"` or `"reversed"`. Null value otherwise.

Hide object

The ACH return code, e.g. `R01`. A return code will be provided if and only if the transfer status is `reversed`. For a full listing of ACH return codes, see [Bank Transfers errors](https://plaid.com/docs/errors/bank-transfers/#ach-return-codes).

A human-readable description of the reason for the failure or reversal.

Indicates the direction of the transfer: `outbound` for API-initiated transfers, or `inbound` for payments received by the FBO account.

Possible values: `outbound`, `inbound`, `null`

A unique identifier for the request, which can be used for troubleshooting. This identifier, like all Plaid identifiers, is case sensitive.

API Object

Copy

```CodeBlock-module_code__18Tbe

1{
2  "bank_transfer_events": [\
3    {\
4      "account_id": "6qL6lWoQkAfNE3mB8Kk5tAnvpX81qefrvvl7B",\
5      "bank_transfer_amount": "12.34",\
6      "bank_transfer_id": "460cbe92-2dcc-8eae-5ad6-b37d0ec90fd9",\
7      "bank_transfer_iso_currency_code": "USD",\
8      "bank_transfer_type": "credit",\
9      "direction": "outbound",\
10      "event_id": 1,\
11      "event_type": "pending",\
12      "failure_reason": null,\
13      "origination_account_id": "",\
14      "timestamp": "2020-08-06T17:27:15Z"\
15    }\
16  ],
17  "request_id": "mdqfuVxeoza6mhu"
18}
```

##### Was this helpful?

YesNo

[**`/bank_transfer/event/sync`**](https://plaid.com/docs/api/products/auth/#bank_transfereventsync)

[**Sync bank transfer events**](https://plaid.com/docs/api/products/auth/#sync-bank-transfer-events)

[`/bank_transfer/event/sync`](https://plaid.com/docs/api/products/auth/#bank_transfereventsync) allows you to request up to the next 25 Plaid-initiated bank transfer events that happened after a specific `event_id`. When using Auth with micro-deposit verification enabled, this endpoint can be used to fetch status updates on ACH micro-deposits. For more details, see [micro-deposit events](https://www.plaid.com/docs/auth/coverage/microdeposit-events/).

bank\_transfer/event/sync

**Request fields**

Your Plaid API `client_id`. The `client_id` is required and may be provided either in the `PLAID-CLIENT-ID` header or as part of a request body.

Your Plaid API `secret`. The `secret` is required and may be provided either in the `PLAID-SECRET` header or as part of a request body.

The latest (largest) `event_id` fetched via the sync endpoint, or 0 initially.

Minimum: `0`

The maximum number of bank transfer events to return.

Default: `25`

Minimum: `1`

Maximum: `25`

Select group for content switcher

Current librariesLegacy libraries

Node

Select Language

- Curl
- Node
- Python
- Ruby
- Java
- Go

Copy

```CodeBlock-module_code__18Tbe

1const request: BankTransferEventListRequest = {
2  after_id: afterID,
3  count: 25,
4};
5try {
6  const response = await plaidClient.bankTransferEventSync(request);
7  const events = response.data.bank_transfer_events;
8  for (const event of events) {
9    // iterate through events
10  }
11} catch (error) {
12  // handle error
13}
```

bank\_transfer/event/sync

**Response fields** and example

Collapse all

Hide object

Plaid’s unique identifier for this event. IDs are sequential unsigned 64-bit integers.

Minimum: `0`

The datetime when this event occurred. This will be of the form `2006-01-02T15:04:05Z`.

Format: `date-time`

The type of event that this bank transfer represents.

`pending`: A new transfer was created; it is in the pending state.

`cancelled`: The transfer was cancelled by the client.

`failed`: The transfer failed, no funds were moved.

`posted`: The transfer has been successfully submitted to the payment network.

`reversed`: A posted transfer was reversed.

Possible values: `pending`, `cancelled`, `failed`, `posted`, `reversed`

The account ID associated with the bank transfer.

Plaid’s unique identifier for a bank transfer.

The ID of the origination account that this balance belongs to.

The type of bank transfer. This will be either `debit` or `credit`. A `debit` indicates a transfer of money into the origination account; a `credit` indicates a transfer of money out of the origination account.

Possible values: `debit`, `credit`

The bank transfer amount.

The currency of the bank transfer amount.

The failure reason if the type of this transfer is `"failed"` or `"reversed"`. Null value otherwise.

Hide object

The ACH return code, e.g. `R01`. A return code will be provided if and only if the transfer status is `reversed`. For a full listing of ACH return codes, see [Bank Transfers errors](https://plaid.com/docs/errors/bank-transfers/#ach-return-codes).

A human-readable description of the reason for the failure or reversal.

Indicates the direction of the transfer: `outbound` for API-initiated transfers, or `inbound` for payments received by the FBO account.

Possible values: `outbound`, `inbound`, `null`

A unique identifier for the request, which can be used for troubleshooting. This identifier, like all Plaid identifiers, is case sensitive.

API Object

Copy

```CodeBlock-module_code__18Tbe

1{
2  "bank_transfer_events": [\
3    {\
4      "account_id": "6qL6lWoQkAfNE3mB8Kk5tAnvpX81qefrvvl7B",\
5      "bank_transfer_amount": "12.34",\
6      "bank_transfer_id": "460cbe92-2dcc-8eae-5ad6-b37d0ec90fd9",\
7      "bank_transfer_iso_currency_code": "USD",\
8      "bank_transfer_type": "credit",\
9      "direction": "outbound",\
10      "event_id": 1,\
11      "event_type": "pending",\
12      "failure_reason": null,\
13      "origination_account_id": "",\
14      "timestamp": "2020-08-06T17:27:15Z"\
15    }\
16  ],
17  "request_id": "mdqfuVxeoza6mhu"
18}
```

##### Was this helpful?

YesNo

[**Webhooks**](https://plaid.com/docs/api/products/auth/#webhooks)

Updates are sent for Items that are linked using micro-deposits (excluding Instant Micro-deposits).

When an automated micro-deposit is created, Plaid sends a webhook upon successful verification. If verification does not succeed after seven days for an automated micro-deposit, Plaid sends a `VERIFICATION_EXPIRED` webhook. If you attempt to retrieve an automated micro-deposit Item before verification succeeds, you’ll receive a response with the HTTP status code 400 and a Plaid error code of `PRODUCT_NOT_READY`. For Same-Day micro-deposits, Plaid does not send `AUTOMATICALLY_VERIFIED` or `VERIFICATION_EXPIRED` webhooks, but you may instead use the `BANK_TRANSFERS_EVENTS_UPDATE` webhook to [access the underlying ACH events](https://plaid.com/docs/auth/coverage/microdeposit-events/) of micro-deposits.

Plaid will trigger a `DEFAULT_UPDATE` webhook for Items that undergo a change in Auth data. This is generally caused by data partners notifying Plaid of a change in their account numbering system or to their routing numbers. To avoid returned transactions, customers that receive a `DEFAULT_UPDATE` webhook with the `account_ids_with_updated_auth` object populated should immediately discontinue all usages of existing Auth data for those accounts and call [`/auth/get`](https://plaid.com/docs/api/products/auth/#authget) or [`/processor/auth/get`](https://plaid.com/docs/api/processor-partners/#processorauthget) to obtain updated account and routing numbers.

[**`DEFAULT_UPDATE`**](https://plaid.com/docs/api/products/auth/#default_update)

Plaid will trigger a `DEFAULT_UPDATE` webhook for Items that undergo a change in Auth data. This is generally caused by data partners notifying Plaid of a change in their account numbering system or to their routing numbers. To avoid returned transactions, customers that receive a `DEFAULT_UPDATE` webhook with the `account_ids_with_updated_auth` object populated should immediately discontinue all usages of existing Auth data for those accounts and call [`/auth/get`](https://plaid.com/docs/api/products/auth/#authget) or [`/processor/auth/get`](https://plaid.com/docs/api/processor-partners/#processorauthget) to obtain updated account and routing numbers.

Collapse all

`AUTH`

`DEFAULT_UPDATE`

The `item_id` of the Item associated with this webhook, warning, or error

An array of `account_id`'s for accounts that contain new auth.

An object with keys of `account_id`'s that are mapped to their respective auth attributes that changed. `ACCOUNT_NUMBER` and `ROUTING_NUMBER` are the two potential values that can be flagged as updated.

Example: `{ "XMBvvyMGQ1UoLbKByoMqH3nXMj84ALSdE5B58": ["ACCOUNT_NUMBER"] }`

Errors are identified by `error_code` and categorized by `error_type`. Use these in preference to HTTP status codes to identify and handle specific errors. HTTP status codes are set and provide the broadest categorization of errors: 4xx codes are for developer- or user-related errors, and 5xx codes are for Plaid-related errors, and the status will be 2xx in non-error cases. An Item with a non- `null` error object will only be part of an API response when calling `/item/get` to view Item status. Otherwise, error fields will be `null` if no error has occurred; if an error has occurred, an error code will be returned instead.

Hide object

A broad categorization of the error. Safe for programmatic use.

Possible values: `INVALID_REQUEST`, `INVALID_RESULT`, `INVALID_INPUT`, `INSTITUTION_ERROR`, `RATE_LIMIT_EXCEEDED`, `API_ERROR`, `ITEM_ERROR`, `ASSET_REPORT_ERROR`, `RECAPTCHA_ERROR`, `OAUTH_ERROR`, `PAYMENT_ERROR`, `BANK_TRANSFER_ERROR`, `INCOME_VERIFICATION_ERROR`, `MICRODEPOSITS_ERROR`, `SANDBOX_ERROR`, `PARTNER_ERROR`, `TRANSACTIONS_ERROR`, `TRANSACTION_ERROR`, `TRANSFER_ERROR`

The particular error code. Safe for programmatic use.

The specific reason for the error code. Currently, reasons are only supported OAuth-based item errors; `null` will be returned otherwise. Safe for programmatic use.

Possible values:
`OAUTH_INVALID_TOKEN`: The user’s OAuth connection to this institution has been invalidated.

`OAUTH_CONSENT_EXPIRED`: The user's access consent for this OAuth connection to this institution has expired.

`OAUTH_USER_REVOKED`: The user’s OAuth connection to this institution is invalid because the user revoked their connection.

A developer-friendly representation of the error code. This may change over time and is not safe for programmatic use.

A user-friendly representation of the error code. `null` if the error is not related to user action.

This may change over time and is not safe for programmatic use.

A unique ID identifying the request, to be used for troubleshooting purposes. This field will be omitted in errors provided by webhooks.

In this product, a request can pertain to more than one Item. If an error is returned for such a request, `causes` will return an array of errors containing a breakdown of these errors on the individual Item level, if any can be identified.

`causes` will only be provided for the `error_type` `ASSET_REPORT_ERROR`. `causes` will also not be populated inside an error nested within a `warning` object.

The HTTP status code associated with the error. This will only be returned in the response body when the error information is provided via a webhook.

The URL of a Plaid documentation page with more information about the error

Suggested steps for resolving the error

The Plaid environment the webhook was sent from

Possible values: `sandbox`, `production`

API Object

Copy

```CodeBlock-module_code__18Tbe

1{
2  "webhook_type": "AUTH",
3  "webhook_code": "DEFAULT_UPDATE",
4  "item_id": "wz666MBjYWTp2PDzzggYhM6oWWmBb",
5  "account_ids_with_updated_auth": {
6    "BxBXxLj1m4HMXBm9WZZmCWVbPjX16EHwv99vp": [\
7      "ACCOUNT_NUMBER"\
8    ]
9  },
10  "error": null,
11  "environment": "production"
12}
```

##### Was this helpful?

YesNo

[**`AUTOMATICALLY_VERIFIED`**](https://plaid.com/docs/api/products/auth/#automatically_verified)

Fired when an Item is verified via automated micro-deposits. We recommend communicating to your users when this event is received to notify them that their account is verified and ready for use.

Collapse all

`AUTH`

`AUTOMATICALLY_VERIFIED`

The `account_id` of the account associated with the webhook

The `item_id` of the Item associated with this webhook, warning, or error

The Plaid environment the webhook was sent from

Possible values: `sandbox`, `production`

Errors are identified by `error_code` and categorized by `error_type`. Use these in preference to HTTP status codes to identify and handle specific errors. HTTP status codes are set and provide the broadest categorization of errors: 4xx codes are for developer- or user-related errors, and 5xx codes are for Plaid-related errors, and the status will be 2xx in non-error cases. An Item with a non- `null` error object will only be part of an API response when calling `/item/get` to view Item status. Otherwise, error fields will be `null` if no error has occurred; if an error has occurred, an error code will be returned instead.

Hide object

A broad categorization of the error. Safe for programmatic use.

Possible values: `INVALID_REQUEST`, `INVALID_RESULT`, `INVALID_INPUT`, `INSTITUTION_ERROR`, `RATE_LIMIT_EXCEEDED`, `API_ERROR`, `ITEM_ERROR`, `ASSET_REPORT_ERROR`, `RECAPTCHA_ERROR`, `OAUTH_ERROR`, `PAYMENT_ERROR`, `BANK_TRANSFER_ERROR`, `INCOME_VERIFICATION_ERROR`, `MICRODEPOSITS_ERROR`, `SANDBOX_ERROR`, `PARTNER_ERROR`, `TRANSACTIONS_ERROR`, `TRANSACTION_ERROR`, `TRANSFER_ERROR`

The particular error code. Safe for programmatic use.

The specific reason for the error code. Currently, reasons are only supported OAuth-based item errors; `null` will be returned otherwise. Safe for programmatic use.

Possible values:
`OAUTH_INVALID_TOKEN`: The user’s OAuth connection to this institution has been invalidated.

`OAUTH_CONSENT_EXPIRED`: The user's access consent for this OAuth connection to this institution has expired.

`OAUTH_USER_REVOKED`: The user’s OAuth connection to this institution is invalid because the user revoked their connection.

A developer-friendly representation of the error code. This may change over time and is not safe for programmatic use.

A user-friendly representation of the error code. `null` if the error is not related to user action.

This may change over time and is not safe for programmatic use.

A unique ID identifying the request, to be used for troubleshooting purposes. This field will be omitted in errors provided by webhooks.

In this product, a request can pertain to more than one Item. If an error is returned for such a request, `causes` will return an array of errors containing a breakdown of these errors on the individual Item level, if any can be identified.

`causes` will only be provided for the `error_type` `ASSET_REPORT_ERROR`. `causes` will also not be populated inside an error nested within a `warning` object.

The HTTP status code associated with the error. This will only be returned in the response body when the error information is provided via a webhook.

The URL of a Plaid documentation page with more information about the error

Suggested steps for resolving the error

API Object

Copy

```CodeBlock-module_code__18Tbe

1{
2  "webhook_type": "AUTH",
3  "webhook_code": "AUTOMATICALLY_VERIFIED",
4  "item_id": "eVBnVMp7zdTJLkRNr33Rs6zr7KNJqBFL9DrE6",
5  "account_id": "dVzbVMLjrxTnLjX4G66XUp5GLklm4oiZy88yK",
6  "environment": "production",
7  "error": null
8}
```

##### Was this helpful?

YesNo

[**`VERIFICATION_EXPIRED`**](https://plaid.com/docs/api/products/auth/#verification_expired)

Fired when an Item was not verified via automated micro-deposits after seven days since the automated micro-deposit was made.

Collapse all

`AUTH`

`VERIFICATION_EXPIRED`

The `item_id` of the Item associated with this webhook, warning, or error

The `account_id` of the account associated with the webhook

The Plaid environment the webhook was sent from

Possible values: `sandbox`, `production`

Errors are identified by `error_code` and categorized by `error_type`. Use these in preference to HTTP status codes to identify and handle specific errors. HTTP status codes are set and provide the broadest categorization of errors: 4xx codes are for developer- or user-related errors, and 5xx codes are for Plaid-related errors, and the status will be 2xx in non-error cases. An Item with a non- `null` error object will only be part of an API response when calling `/item/get` to view Item status. Otherwise, error fields will be `null` if no error has occurred; if an error has occurred, an error code will be returned instead.

Hide object

A broad categorization of the error. Safe for programmatic use.

Possible values: `INVALID_REQUEST`, `INVALID_RESULT`, `INVALID_INPUT`, `INSTITUTION_ERROR`, `RATE_LIMIT_EXCEEDED`, `API_ERROR`, `ITEM_ERROR`, `ASSET_REPORT_ERROR`, `RECAPTCHA_ERROR`, `OAUTH_ERROR`, `PAYMENT_ERROR`, `BANK_TRANSFER_ERROR`, `INCOME_VERIFICATION_ERROR`, `MICRODEPOSITS_ERROR`, `SANDBOX_ERROR`, `PARTNER_ERROR`, `TRANSACTIONS_ERROR`, `TRANSACTION_ERROR`, `TRANSFER_ERROR`

The particular error code. Safe for programmatic use.

The specific reason for the error code. Currently, reasons are only supported OAuth-based item errors; `null` will be returned otherwise. Safe for programmatic use.

Possible values:
`OAUTH_INVALID_TOKEN`: The user’s OAuth connection to this institution has been invalidated.

`OAUTH_CONSENT_EXPIRED`: The user's access consent for this OAuth connection to this institution has expired.

`OAUTH_USER_REVOKED`: The user’s OAuth connection to this institution is invalid because the user revoked their connection.

A developer-friendly representation of the error code. This may change over time and is not safe for programmatic use.

A user-friendly representation of the error code. `null` if the error is not related to user action.

This may change over time and is not safe for programmatic use.

A unique ID identifying the request, to be used for troubleshooting purposes. This field will be omitted in errors provided by webhooks.

In this product, a request can pertain to more than one Item. If an error is returned for such a request, `causes` will return an array of errors containing a breakdown of these errors on the individual Item level, if any can be identified.

`causes` will only be provided for the `error_type` `ASSET_REPORT_ERROR`. `causes` will also not be populated inside an error nested within a `warning` object.

The HTTP status code associated with the error. This will only be returned in the response body when the error information is provided via a webhook.

The URL of a Plaid documentation page with more information about the error

Suggested steps for resolving the error

API Object

Copy

```CodeBlock-module_code__18Tbe

1{
2  "webhook_type": "AUTH",
3  "webhook_code": "VERIFICATION_EXPIRED",
4  "item_id": "eVBnVMp7zdTJLkRNr33Rs6zr7KNJqBFL9DrE6",
5  "account_id": "BxBXxLj1m4HMXBm9WZZmCWVbPjX16EHwv99vp",
6  "environment": "production",
7  "error": null
8}
```

##### Was this helpful?

YesNo

[**BANK\_TRANSFERS\_EVENTS\_UPDATE**](https://plaid.com/docs/api/products/auth/#bank_transfers_events_update)

Fired when new ACH events are available. To begin receiving this webhook, you must first register your webhook listener endpoint via the [webhooks page in the Dashboard](https://dashboard.plaid.com/team/webhooks). The `BANK_TRANSFERS_EVENTS_UPDATE` webhook can be used to track the progress of ACH transfers used in [micro-deposit verification](https://plaid.com/docs/auth/coverage/microdeposit-events/). Receiving this webhook indicates you should fetch the new events from [`/bank_transfer/event/sync`](https://plaid.com/docs/api/products/auth/#bank_transfereventsync). Note that [Transfer](https://plaid.com/docs/transfer) customers should use Transfer webhooks instead of using `BANK_TRANSFERS_EVENTS_UPDATE`; see [micro-deposit events documentation](https://plaid.com/docs/auth/coverage/microdeposit-events/) for more details.

`BANK_TRANSFERS`

`BANK_TRANSFERS_EVENTS_UPDATE`

The Plaid environment the webhook was sent from

Possible values: `sandbox`, `production`

API Object

Copy

```CodeBlock-module_code__18Tbe

1{
2  "webhook_type": "BANK_TRANSFERS",
3  "webhook_code": "BANK_TRANSFERS_EVENTS_UPDATE",
4  "environment": "production"
5}
```

##### Was this helpful?

YesNo

[**SMS\_MICRODEPOSITS\_VERIFICATION**](https://plaid.com/docs/api/products/auth/#sms_microdeposits_verification)

Contains the state of a SMS same-day microdeposits verification session.

`AUTH`

`SMS_MICRODEPOSITS_VERIFICATION`

The final status of the same-day microdeposits verification. Will always be `MANUALLY_VERIFIED` or `VERIFICATION_FAILED`.

The `item_id` of the Item associated with this webhook, warning, or error

The external account ID of the affected account

The Plaid environment the webhook was sent from

Possible values: `sandbox`, `production`

API Object

Copy

```CodeBlock-module_code__18Tbe

1{
2  "webhook_type": "AUTH",
3  "webhook_code": "SMS_MICRODEPOSITS_VERIFICATION",
4  "status": "MANUALLY_VERIFIED",
5  "item_id": "eVBnVMp7zdTJLkRNr33Rs6zr7KNJqBFL9DrE6",
6  "account_id": "dVzbVMLjrxTnLjX4G66XUp5GLklm4oiZy88yK",
7  "environment": "sandbox"
8}
```

##### Was this helpful?

YesNo

![Company Logo](https://cdn.cookielaw.org/logos/static/ot_company_logo.png)

## Website Data Collection Preferences

Plaid uses data collected by cookies and JavaScript libraries to improve your browsing experience, analyze site traffic, deliver personalized advertisements, and increase the overall performance of our site.

This table outlines how we use this data by category. Click on the different category headings to find out more and change the default settings. You cannot opt-out of our First Party Strictly Necessary Cookies as they are deployed in order to ensure the proper functioning of our website (such as prompting the cookie banner and remembering your settings, to log into your account, to redirect you when you log out, etc.).

By using our website, you're agreeing to the use of cookies as described in our Cookie Policy.


[Cookie Policy](https://plaid.com/legal/#cookie-policy)

Allow All

### Manage Consent Preferences

#### Strictly Necessary Cookies

Always Active

These cookies are necessary for the website to function and cannot be switched off in our systems. They are usually only set in response to actions made by you which amount to a request for services, such as setting your privacy preferences, logging in or filling in forms. You can set your browser to block or alert you about these cookies, but some parts of the site will not then work. These cookies do not store any personally identifiable information.

#### Functional Cookies

Functional Cookies

These cookies enable the website to provide enhanced functionality and personalisation. They may be set by us or by third party providers whose services we have added to our pages. If you do not allow these cookies then some or all of these services may not function properly.

#### Targeting Cookies

Targeting Cookies

These cookies may be set through our site by our advertising partners. They may be used by those companies to build a profile of your interests and show you relevant adverts on other sites. They do not store directly personal information, but are based on uniquely identifying your browser and internet device. If you do not allow these cookies, you will experience less targeted advertising.

Back Button

### Cookie List

Search Icon

Filter Icon

Clear

checkbox labellabel

ApplyCancel

ConsentLeg.Interest

checkbox labellabel

checkbox labellabel

checkbox labellabel

Confirm My Choices

[![Powered by Onetrust](https://cdn.cookielaw.org/logos/static/powered_by_logo.svg)](https://www.onetrust.com/products/cookie-consent/)

Qualified