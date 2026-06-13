# API Documentation

The BlackWater backend utilizes a strict RESTful design. All endpoints are protected via JWT Authentication and RBAC (Role-Based Access Control) unless explicitly prefixed with `/api/public/`.

## 1. Internal Engineering API (Protected)

Requires `Authorization: Bearer <token>` in the header.

### Declare a New Incident

**Endpoint:** `POST /api/incidents`  
**Role Required:** `ADMIN`

**Request Payload:**
```json
{
  "title": "Global API Gateway Failure",
  "severity": "CRITICAL",
  "serviceId": "uuid-v4-service-id",
  "organizationId": "uuid-v4-org-id",
  "initialUpdate": {
    "message": "Investigating massive spike in 502 errors.",
    "isPublic": true
  }
}
```

**Response (201 Created):**
```json
{
  "id": "uuid-v4-incident-id",
  "status": "TRIGGERED",
  "severity": "CRITICAL",
  "createdAt": "2023-10-27T10:00:00Z",
  "service": {
    "id": "uuid-v4-service-id",
    "name": "API Gateway",
    "status": "DEGRADED"
  }
}
```
*Note: This API internally triggers a WebSocket broadcast and creates immutable Timeline Events.*

---

### Add an Internal Engineering Note

**Endpoint:** `POST /api/incidents/:id/updates`  
**Role Required:** `MEMBER` or `ADMIN`

**Request Payload:**
```json
{
  "message": "Found the issue. PGBouncer is running out of connections. Restarting the pod.",
  "isPublic": false
}
```

**Response (201 Created):**
```json
{
  "id": "uuid-v4-update-id",
  "message": "Found the issue. PGBouncer is running out of connections. Restarting the pod.",
  "isPublic": false,
  "author": "Ayush",
  "timestamp": "2023-10-27T10:15:00Z"
}
```

---

## 2. Public Status API (Unauthenticated)

No authentication required. Highly cached and rate-limited.

### Fetch Global Service Health

**Endpoint:** `GET /api/public/status/:organizationId`

**Response (200 OK):**
```json
{
  "globalState": "MAJOR_OUTAGE",
  "lastUpdated": "2023-10-27T10:15:00Z",
  "services": [
    {
      "name": "API Gateway",
      "status": "DEGRADED"
    },
    {
      "name": "Core Database",
      "status": "OPERATIONAL"
    }
  ],
  "activeIncidents": [
    {
      "title": "Global API Gateway Failure",
      "severity": "CRITICAL",
      "status": "TRIGGERED",
      "startedAt": "2023-10-27T10:00:00Z",
      "updates": [
        {
          "message": "Investigating massive spike in 502 errors.",
          "timestamp": "2023-10-27T10:00:00Z"
        }
      ]
    }
  ]
}
```
*Notice: The internal engineering note regarding PGBouncer is completely omitted from this DTO payload.*
