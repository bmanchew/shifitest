URL: https://docs.didit.me/identity-verification/api-reference/retrieve-session
---
🎉 Unlimited Free KYC - Forever!!

Identity Verification

API Reference

Retrieve Session

# Retrieving a Verification Result

To retrieve the results of a verification session, you can call the `/v1/session/{sessionId}/decision/` endpoint.

- **Base URL:** `https://verification.didit.me`
- **Endpoint:** `/v1/session/{sessionId}/decision/`
- **Method:** `GET`
- **Authentication:** `Client Token (Bearer Token)`

⚠️

The `Authentication` endpoint has a different `Base URL` than the verification
session endpoints. Ensure you are using the correct URLs for each endpoint to
avoid connectivity issues.

## Request [Permalink for this section](https://docs.didit.me/identity-verification/api-reference/retrieve-session\#request)

To retrieve a verification result programmatically, follow these steps:

### Authenticate [Permalink for this section](https://docs.didit.me/identity-verification/api-reference/retrieve-session\#authenticate)

To obtain the `access_token`, refer to the [Authentication](https://docs.didit.me/identity-verification/api-reference/authentication) documentation page.

ℹ️

The `access_token` is valid for a limited time (x minutes), so you do not need
to authenticate for every request until the token expires.

### Select Desired Parameters [Permalink for this section](https://docs.didit.me/identity-verification/api-reference/retrieve-session\#select-desired-parameters)

- `session_id`: Unique identifier for the session.

### Retrieve Verification Result [Permalink for this section](https://docs.didit.me/identity-verification/api-reference/retrieve-session\#retrieve-verification-result)

Use the following request format to retrieve the verification result:

```nx-border-black nx-border-opacity-[0.04] nx-bg-opacity-[0.03] nx-bg-black nx-break-words nx-rounded-md nx-border nx-py-0.5 nx-px-[.25em] nx-text-[.9em] dark:nx-border-white/10 dark:nx-bg-white/10
GET /v1/session/{session_id}/decision/ HTTP/1.1
Host: verification.didit.me
Content-Type: application/json
Authorization: Bearer {access_token}
```

## Response [Permalink for this section](https://docs.didit.me/identity-verification/api-reference/retrieve-session\#response)

Returns detailed information about the verification session, including KYC, AML, facial recognition results, address verification, warnings, and reviews.

### Example Response [Permalink for this section](https://docs.didit.me/identity-verification/api-reference/retrieve-session\#example-response)

```nx-border-black nx-border-opacity-[0.04] nx-bg-opacity-[0.03] nx-bg-black nx-break-words nx-rounded-md nx-border nx-py-0.5 nx-px-[.25em] nx-text-[.9em] dark:nx-border-white/10 dark:nx-bg-white/10
{
  "session_id": "11111111-2222-3333-4444-555555555555",
  "session_number": 43762,
  "session_url": "https://verify.didit.me/session/11111111-2222-3333-4444-555555555555",
  "status": "Declined",
  "vendor_data": "11111111-1111-1111-1111-111111111111",
  "callback": "https://verify.didit.me/",
  "features": "OCR + FACE",
  "kyc": {
    "status": "Approved",
    "ocr_status": "Approved",
    "epassport_status": "Approved",
    "document_type": "Passport",
    "document_number": "BK123456",
    "personal_number": "999999999",
    "portrait_image": "https://example.com/portrait.jpg",
    "front_image": "https://example.com/front.jpg",
    "front_video": "https://example.com/front.mp4",
    "back_image": null,
    "back_video": null,
    "full_front_image": "https://example.com/full_front.jpg",
    "full_back_image": null,
    "date_of_birth": "1990-01-01",
    "expiration_date": "2026-03-24",
    "date_of_issue": "2019-03-24",
    "issuing_state": "ESP",
    "issuing_state_name": "Spain",
    "first_name": "Sergey",
    "last_name": "Kozlov",
    "full_name": "Sergey Kozlov",
    "gender": "M",
    "address": "C Clot 36 P02,Barcelona,Barcelona Esp",
    "formatted_address": "Carrer del Clot, 36, p02, Sant Martí, 08018 Barcelona, Spain",
    "is_nfc_verified": false,
    "parsed_address": null,
    "place_of_birth": "Madrid, Spain",
    "marital_status": "SINGLE",
    "nationality": "ESP",
    "created_at": "2024-07-28T06:46:39.354573Z"
  },
  "aml": {
    "status": "In Review",
    "total_hits": 1,
    "score": 70.35, // score of the highest hit from 0 to 100
    "hits": [\
      {\
        "id": "aaaaaaa-1111-2222-3333-4444-555555555555",\
        "match": false,\
        "score": 0.7034920634920635, // score of the hit from 0 to 1\
        "target": true,\
        "caption": "Kozlov Sergey Alexandrovich",\
        "datasets": ["ru_acf_bribetakers"],\
        "features": {\
          "person_name_jaro_winkler": 0.8793650793650793,\
          "person_name_phonetic_match": 0.5\
        },\
        "last_seen": "2024-07-20T17:53:03",\
        "first_seen": "2023-06-23T12:02:51",\
        "properties": {\
          "name": ["Kozlov Sergey Alexandrovich"],\
          "alias": ["Козлов Сергей Александрович"],\
          "notes": [\
            "Assistant Prosecutor of the Soviet District of Voronezh. Involved in the case against the Ukrainian pilot Nadiya Savchenko"\
          ],\
          "gender": ["male"],\
          "topics": ["poi"],\
          "position": [\
            "Organizers of political repressions",\
            "Организаторы политических репрессий"\
          ]\
        },\
        "last_change": "2024-02-27T17:53:01"\
      }\
    ]
  },
  "face": {
    "status": "Approved",
    "face_match_status": "Approved",
    "liveness_status": "Approved",
    "face_match_similarity": 97.99,
    "liveness_confidence": 87.99,
    "source_image": "https://example.com/source.jpg",
    "target_image": "https://example.com/target.jpg",
    "video_url": "https://example.com/video.mp4",
    "age_estimation": 24.3,
    "gender_estimation": {
      "male": 99.23,
      "female": 0.77
    }
  },
  "location": {
      "device_brand": "Apple",
      "device_model": "iPhone",
      "browser_family": "Mobile Safari",
      "os_family": "iOS",
      "platform": "mobile",
      "ip_country": "Spain",
      "ip_country_code": "ES",
      "ip_state": "Barcelona",
      "ip_city": "Barcelona",
      "latitude": 41.4022,
      "longitude": 2.1407,
      "ip_address": "83.50.226.71",
      "isp": null,
      "organization": null,
      "is_vpn_or_tor": false,
      "is_data_center": false,
      "time_zone": "Europe/Madrid",
      "time_zone_offset": "+0100",
      "status": "Approved",
      "document_location": {
        "latitude": 4,
        "longitude": -72
      },
      "ip_location": {
        "longitude": 2.1407,
        "latitude": 41.4022
      },
      "distance_from_document_to_ip_km": {
        "distance": 8393.68,
        "direction": "NE"
      }
  },
  "warnings": [\
    {\
      "feature": "AML",\
      "risk": "POSSIBLE_MATCH_FOUND",\
      "additional_data": null,\
      "log_type": "warning",\
      "short_description": "Possible match found in AML screening",\
      "long_description": "The Anti-Money Laundering (AML) screening process identified potential matches with watchlists or high-risk databases, requiring further review."\
    }\
  ],
  "reviews": [\
    {\
      "user": "compliance@example.com",\
      "new_status": "Declined",\
      "comment": "Possible match found in AML screening",\
      "created_at": "2024-07-18T13:29:00.366811Z"\
    }\
  ],
  "extra_images": [],
  "created_at": "2024-07-24T08:54:25.443172Z"
}
```

## Code Example [Permalink for this section](https://docs.didit.me/identity-verification/api-reference/retrieve-session\#code-example)

```nx-border-black nx-border-opacity-[0.04] nx-bg-opacity-[0.03] nx-bg-black nx-break-words nx-rounded-md nx-border nx-py-0.5 nx-px-[.25em] nx-text-[.9em] dark:nx-border-white/10 dark:nx-bg-white/10
const getSessionDecision = async (sessionId) => {
  const endpoint = `${BASE_URL}/v1/session/${sessionId}/decision/`;
  const token = await getClientToken();

  if (!token) {
    console.error('Error fetching client token');
  } else {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token.access_token}`,
    };

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (response.ok) {
        return data;
      } else {
        console.error('Error fetching session decision:', data.message);
        throw new Error(data.message);
      }
    } catch (err) {
      console.error('Network error:', err);
      throw err;
    }
  }
};
```

Last updated on February 25, 2025

[Create Session](https://docs.didit.me/identity-verification/api-reference/create-session "Create Session") [Generate PDF](https://docs.didit.me/identity-verification/api-reference/generate-pdf "Generate PDF")