# Durra SmartBand API Documentation

## Base URL
```
http://localhost:5000/api
```

## Implementation updates (applied)

- Applied `search` rate limiter to `GET /auth/search-pilgrims` (30 requests/min).
- Applied general protected-endpoints limiter (1000 requests / 15 minutes) to group, admin, and protected hardware routes.
- Made `phone_number` required on user registration to match the `User` model.
- Added `battery_percent` to `HardwareBand` model and exposed it in relevant endpoints.
- Added `age` and `gender` to `Pilgrim` model and registration/details endpoints.
- Added `assign-bands` and `unassign-bands` endpoints for groups to manage available hardware.
- Added logic to exclude assigned bands from global band list (`exclude_assigned_to_groups`).
- Fixed group delete permission check (now correctly verifies moderator membership).


## Authentication
All protected routes require a JWT token in the `Authorization` header:
```
Authorization: Bearer <token>
```

---

## Rate Limiting

All endpoints are protected with rate limiting to prevent abuse:

| Endpoint Type | Limit | Window | Applied To |
|--------------|-------|--------|------------|
| Auth Limiter | 5 attempts | 15 minutes | POST /api/auth/register, POST /api/auth/login |
| Hardware Limiter | 1000 requests | 1 minute | POST /api/hardware/ping |
| Search Limiter | 30 requests | 1 minute | GET /api/auth/search-pilgrims |
| General Limiter | 100 requests | 15 minutes | All other protected endpoints |

**Rate Limit Exceeded Response** (HTTP 429):
```json
{
  "error": "Too many requests, please try again later."
}
```

---

## Pagination

List endpoints support pagination with the following query parameters:

### Query Parameters
- `page` (optional): Page number, default = 1, minimum = 1
- `limit` (optional): Items per page, default varies by endpoint, maximum = 100 for admin endpoints, 50 for groups, 20 for search

### Response Format
All paginated responses include:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

---

## 🔐 Authentication Endpoints (`/auth`)

### 1. Register User
- **POST** `/auth/register`
- **Public** (No auth required)
- **Description:** Register as a moderator. New users automatically get the **moderator** role.
- **Body:**
  ```json
  {
    "full_name": "John Doe",
    "email": "john@example.com",
    "password": "securepassword123",
    "phone_number": "+201234567890"
  }
  ```
- **Response (201):**
  ```json
  {
    "message": "User created successfully",
    "user_id": "60d5ec49c1234567890abcde"
  }
  ```
- **Note:** Users registering via this endpoint automatically get the **moderator** role and can immediately start managing groups and pilgrims.

### 2. Login
- **POST** `/auth/login`
- **Public** (No auth required)
- **Body:**
  ```json
  {
    "email": "john@example.com",
    "password": "securepassword123"
  }
  ```
- **Response (200):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "role": "moderator",
    "full_name": "John Doe",
    "user_id": "60d5ec49c1234567890abcde"
  }
  ```

### 3. Get Current Profile
- **GET** `/auth/me`
- **Protected** (Requires token)
- **Response (200):**
  ```json
  {
    "_id": "60d5ec49c1234567890abcde",
    "full_name": "John Doe",
    "email": "john@example.com",
    "role": "moderator",
    "phone_number": "+201234567890",
    "created_at": "2024-01-20T10:30:00Z"
  }
  ```

### 4. Update Profile
- **PUT** `/auth/update-profile`
- **Protected** (Requires token)
- **Body:**
  ```json
  {
    "full_name": "John Updated",
    "phone_number": "+201987654321"
  }
  ```
- **Response (200):**
  ```json
  {
    "message": "Profile updated successfully",
    "user": {
      "_id": "60d5ec49c1234567890abcde",
      "full_name": "John Updated",
      "email": "john@example.com",
      "role": "moderator",
      "phone_number": "+201987654321",
      "created_at": "2024-01-20T10:30:00Z"
    }
  }
  ```

### 5. Register Pilgrim (Admin/Moderator)
- **POST** `/auth/register-pilgrim`
- **Auth:** Moderator or Admin only
- **Description:** Quickly register pilgrims. The email field is optional. Used by moderators to onboard pilgrims.
- **Body:**
  ```json
  {
    "full_name": "Ahmed Hassan",
    "national_id": "123456789",
    "phone_number": "+201234567891",
    "medical_history": "Diabetic, takes insulin daily",
    "email": "ahmed@example.com",
    "age": 30,
    "gender": "male"
  }
  ```
- **Note:** `email`, `age`, `gender`, and `phone_number` fields are optional. `gender` can be 'male', 'female', or 'other'.
- **Response (201):**
  ```json
  {
    "message": "Pilgrim registered successfully",
    "pilgrim_id": "60d5ec49c1234567890abce0",
    "national_id": "123456789"
  }
  ```
- **Note:** Pilgrims are a separate entity and cannot login to the app. They are identified by their national ID and wristband assignment.

### 6. Search Pilgrims (Admin/Moderator)
... (Search response also includes age/gender now but let's focus on Get Pilgrim first)

### 6.5. Get Pilgrim by ID
- **GET** `/auth/pilgrims/:pilgrim_id`
- **Auth:** Moderator or Admin only
- **Description:** Retrieve details of a single pilgrim by their ID. Moderators can only retrieve details of pilgrims they have created. Admins can retrieve any pilgrim.
- **Params:** `pilgrim_id` (MongoDB ID)
- **Response (200):**
  ```json
  {
    "_id": "60d5ec49c1234567890abce0",
    "full_name": "Ahmed Hassan",
    "national_id": "123456789",
    "email": "ahmed@example.com",
    "phone_number": "+201234567890",
    "medical_history": "Diabetic, takes insulin daily",
    "age": 30,
    "gender": "male",
    "created_at": "2024-01-20T10:30:00Z",
    "band_info": {
        "serial_number": "BAND-001",
        "last_location": { "lat": 21.4, "lng": 39.8 },
        "last_updated": "2024-01-20T12:00:00Z",
        "imei": "123456789012345",
        "battery_percent": 85
    }
  }
  ```
- **Error (404):** Pilgrim not found



---

## 👥 Group Management Endpoints (`/groups`)

**All group routes require authentication and moderator/admin role**

### 7. Create Group
- **POST** `/groups/create`
- **Auth:** Moderator or Admin
- **Description:** Create a new group. A moderator cannot create two groups with the same name.
- **Body:**
  ```json
  {
    "group_name": "Hajj Group 2024"
  }
  ```
- **Response (201):**
  ```json
  {
    "_id": "60d5f1a9c1234567890abcdf",
    "group_name": "Hajj Group 2024",
    "moderator_ids": ["60d5ec49c1234567890abcde"],
    "pilgrim_ids": [],
    "created_by": "60d5ec49c1234567890abcde"
  }
  ```
- **Error (400):** If you already have a group with this name

### 8. Get My Groups (Dashboard)
- **GET** `/groups/dashboard?page=1&limit=25`
- **Auth:** Moderator or Admin
- **Rate Limit:** 100 requests per 15 minutes
- **Query Parameters:**
  - `page` (optional): Page number, default = 1
  - `limit` (optional): Items per page, default = 25, max = 50
- **Response (200):**
  ```json
  {
    "success": true,
    "data": [
    {
      "_id": "60d5f1a9c1234567890abcdf",
      "group_name": "Hajj Group 2024",
      "moderator_ids": [
        {
          "_id": "60d5ec49c1234567890abcde",
          "full_name": "John Doe",
          "email": "john@example.com"
        }
      ],
      "pilgrims": [
        {
          "_id": "60d5ec49c1234567890abce0",
          "full_name": "Ahmed Hassan",
          "national_id": "123456789",
          "email": "ahmed@example.com",
          "phone_number": "+201234567890",
          "medical_history": "Diabetic, takes insulin daily",
          "age": 30,
          "gender": "male",
          "band_info": {
            "serial_number": "BAND-001",
            "last_location": {
              "lat": 21.4225,
              "lng": 39.8262
            },
            "last_updated": "2024-01-26T15:30:00Z",
            "battery_percent": 85
          }
        }
      ]
    }
    ],
    "pagination": {
      "page": 1,
      "limit": 25,
      "total": 5,
      "pages": 1
    }
  }
  ```

### 8.5. Get Single Group
- **GET** `/groups/:group_id`
- **Auth:** Moderator or Admin (must be a moderator of the group or Admin)
- **Params:** `group_id` (MongoDB ID)
- **Description:** Retrieve details of a single group by its ID.
- **Response (200):**
  ```json
  {
    "_id": "60d5f1a9c1234567890abcdf",
    "group_name": "Hajj Group 2024",
    "moderator_ids": [
      {
        "_id": "60d5ec49c1234567890abcde",
        "full_name": "John Doe",
        "email": "john@example.com"
      }
    ],
    "pilgrims": [
      {
        "_id": "60d5ec49c1234567890abce0",
        "full_name": "Ahmed Hassan",
        "national_id": "123456789",
        "email": "ahmed@example.com",
        "phone_number": "+201234567890",
        "medical_history": "Diabetic, takes insulin daily",
        "age": 30,
        "gender": "male",
        "band_info": {
          "serial_number": "BAND-001",
          "last_location": {
            "lat": 21.4225,
            "lng": 39.8262
          },
          "last_updated": "2024-01-26T15:30:00Z",
          "battery_percent": 85
        }
      }
    ],
    "created_by": "60d5ec49c1234567890abcde",
    "created_at": "2024-01-20T10:30:00Z"
  }
  ```
- **Error (404):** Group not found
- **Error (403):** If you're not an admin or a moderator of the group



### 8.6. Update Group Details
- **PUT** `/groups/:group_id`
- **Auth:** Moderator or Admin (must be a moderator of the group or Admin)
- **Params:** `group_id` (MongoDB ID)
- **Description:** Update details of an existing group. Only the group name is currently updatable.
- **Body:**
  ```json
  {
    "group_name": "New Hajj Group Name 2025"
  }
  ```
- **Response (200):**
  ```json
  {
    "message": "Group updated successfully",
    "group": {
      "_id": "60d5f1a9c1234567890abcdf",
      "group_name": "New Hajj Group Name 2025",
      "moderator_ids": ["60d5ec49c1234567890abcde"],
      "pilgrim_ids": [],
      "created_by": "60d5ec49c1234567890abcde",
      "created_at": "2024-01-20T10:30:00Z"
    }
  }
  ```
- **Error (404):** Group not found
- **Error (403):** If you're not an admin or a moderator of the group
- **Error (400):** If group name already exists for the moderator
- **Body:**
  ```json
  {
    "user_id": "60d5ec49c1234567890abce0"
  }
  ```
- **Response (200):**
  ```json
  {
    "message": "Pilgrim added to group",
    "group": {
      "_id": "60d5f1a9c1234567890abcdf",
      "group_name": "Hajj Group 2024",
      "pilgrim_ids": [
        {
          "_id": "60d5ec49c1234567890abce0",
          "full_name": "Ahmed Hassan",
          "email": "ahmed@example.com",
          "phone_number": "+201234567890",
          "national_id": "123456789",
          "age": 30,
          "gender": "male"
        }
      ]
    }
  }
  ```
- **Error (400):** If trying to add yourself as a pilgrim

### 10. Remove Pilgrim from Group
- **POST** `/groups/:group_id/remove-pilgrim`
- **Auth:** Moderator or Admin
- **Params:** `group_id` (MongoDB ID)
- **Body:**
  ```json
  {
    "user_id": "60d5ec49c1234567890abce0"
  }
  ```
- **Response (200):**
  ```json
  {
    "message": "Pilgrim removed from group",
    "group": {
      "_id": "60d5f1a9c1234567890abcdf",
      "group_name": "Hajj Group 2024",
      "pilgrim_ids": []
    }
  }
  ```

### 11. Assign Band to Pilgrim
- **POST** `/groups/assign-band`
- **Auth:** Moderator or Admin
- **Description:** Assign a hardware band to a pilgrim. The band must be globally unassigned (i.e., its `current_user_id` must be null).
- **Body:**
  ```json
  {
    "serial_number": "BAND-001",
    "user_id": "60d5ec49c1234567890abce0",
    "group_id": "60d5f1a9c1234567890abcdf"
  }
  ```
 - **Note:** The band must be assigned to the group's available pool first by an admin using `/admin/groups/:group_id/assign-bands`. Assigning a band that is not in the group's available list will return HTTP 400.
- **Response (200):**
  ```json
  {
    "message": "Band successfully assigned to pilgrim",
    "band": {
      "_id": "60d5f1a9c1234567890abce1",
      "serial_number": "BAND-001",
      "imei": "358938070000000",
      "status": "active",
      "current_user_id": "60d5ec49c1234567890abce0",
      "last_latitude": null,
      "last_longitude": null,
      "last_updated": null
    }
  }
  ```
- **Errors:**
  - 404: Pilgrim, group or band not found
  - 400: Band is already assigned to another pilgrim

### 11.5. Unassign Band from Pilgrim
- **POST** `/groups/unassign-band`
- **Auth:** Moderator or Admin
- **Description:** Unassigns a hardware band from a pilgrim. The band becomes globally unassigned (its `current_user_id` is set to null).
- **Body:**
  ```json
  {
    "user_id": "60d5ec49c1234567890abce0",
    "group_id": "60d5f1a9c1234567890abcdf"
  }
  ```
- **Response (200):**
  ```json
  {
    "message": "Band successfully unassigned from pilgrim",
    "band": {
      "_id": "60d5f1a9c1234567890abce1",
      "serial_number": "BAND-001",
      "imei": "358938070000000",
      "status": "active",
      "current_user_id": null,
      "last_latitude": null,
      "last_longitude": null,
      "last_updated": null
    }
  }
  ```

### 12. Send Group Alert
- **POST** `/groups/send-alert`
- **Auth:** Moderator or Admin
- **Description:** Send an alert message to all pilgrims in a group. Validates group exists.
- **Body:**
  ```json
  {
    "group_id": "60d5f1a9c1234567890abcdf",
    "message_text": "Please stay together, gathering point is at gate 5"
  }
  ```
- **Response (200):**
  ```json
  {
    "status": "queued",
    "message": "Alert \"Please stay together, gathering point is at gate 5\" sent to group 60d5f1a9c1234567890abcdf",
    "recipients": 5
  }
  ```
- **Error (404):** Group not found

### 12.1 Send Individual Alert
- **POST** `/groups/send-individual-alert`
- **Auth:** Moderator or Admin
- **Description:** Send an alert to a specific pilgrim's wristband. Pilgrim must have a band assigned.
- **Body:**
  ```json
  {
    "user_id": "60d5ec49c1234567890abce0",
    "message_text": "Please return to meeting point"
  }
  ```
- **Response (200):**
  ```json
  {
    "status": "queued",
    "message": "Alert \"Please return to meeting point\" sent to pilgrim Ahmed Hassan",
    "band_serial": "BAND-001"
  }
  ```
- **Errors:**
  - 404: Pilgrim not found
  - 400: Pilgrim doesn't have a band assigned, or user is not a pilgrim

### 12.5 Delete Group
- **DELETE** `/groups/:group_id`
- **Auth:** Moderator or Admin (must be a moderator of the group)
- **Params:** `group_id` (MongoDB ID)
- **Description:** Delete a group and unassign all pilgrims. Only group moderators can delete.
- **Response (200):**
  ```json
  {
    "message": "Group deleted successfully",
    "group_id": "60d5f1a9c1234567890abcdf"
  }
  ```
- **Error (403):** If you're not a moderator of the group

### 12.6 Get Available Bands for Group
- **GET** `/groups/:group_id/available-bands`
- **Auth:** Moderator or Admin
- **Params:** `group_id` (MongoDB ID) - *Note: This parameter is currently ignored by the backend. The endpoint returns all globally unassigned bands regardless of the `group_id` provided.*
- **Description:** Get a list of all hardware bands that are currently globally unassigned (i.e., not assigned to any pilgrim).
- **Response (200):**
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "60d5ec49c1234567890abce1",
        "serial_number": "BAND-001",
        "imei": "358938070000000",
        "status": "active",
        "current_user_id": null,
        "last_latitude": null,
        "last_longitude": null,
        "last_updated": null
      }
    ]
  }
  ```

---

## 📡 Hardware Band Endpoints (`/hardware`)

### 13. Report Location (Public)
- **POST** `/hardware/ping`
- **Description:** Public (No auth required - for wristband use). Includes optional `battery_percent`.
- **Body:**
  ```json
  {
    "serial_number": "BAND-001",
    "lat": 21.4225,
    "lng": 39.8262,
    "battery_percent": 85
  }
  ```
- **Response (200):**
  ```json
  {
    "status": "success",
    "server_time": "2024-01-26T15:45:30Z"
  }
  ```

### 14. Register New Band (Admin)
- **POST** `/hardware/register`
- **Auth:** Admin only
- **Body:**
  ```json
  {
    "serial_number": "BAND-002",
    "imei": "358938070000001",
    "battery_percent": 100
  }
  ```
- **Response (201):**
  ```json
  {
    "message": "Band registered successfully",
    "band": {
      "_id": "60d5f1a9c1234567890abce2",
      "serial_number": "BAND-002",
      "imei": "358938070000001",
      "battery_percent": 100,
      "status": "active",
      "current_user_id": null,
      "last_latitude": null,
      "last_longitude": null,
      "last_updated": null
    }
  }
  ```
   - **Behavior change:** The implementation now returns the subset of bands that were previously assigned to the group's `available_band_ids` by an admin and are currently unassigned (i.e., available to be assigned to pilgrims within that group). If the group does not exist, the endpoint returns HTTP 404.

### 15. Get All Bands (Moderator/Admin)
- **GET** `/hardware/bands?page=1&limit=50&status=active`
- **Auth:** Moderator or Admin
- **Rate Limit:** 100 requests per 15 minutes
- **Query Parameters:**
  - `page` (optional): Page number, default = 1
  - `limit` (optional): Items per page, default = 50, max = 100
  - `status` (optional): Filter by status - `active`, `maintenance`, or `inactive`
  - `exclude_assigned_to_groups` (optional): Set to `true` to exclude bands already assigned to any group.
- **Response (200):**
  ```json
  {
    "success": true,
    "data": [
    {
      "_id": "60d5f1a9c1234567890abce1",
      "serial_number": "BAND-001",
      "imei": "358938070000000",
      "battery_percent": 85,
      "status": "active",
      "current_user_id": {
        "_id": "60d5ec49c1234567890abcde",
        "full_name": "Ahmed Hassan",
        "email": "ahmed@example.com",
        "phone_number": "+201234567890"
      },
      "last_latitude": 21.4225,
      "last_longitude": 39.8262,
      "last_updated": "2024-01-26T15:45:30Z"
    }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 120,
      "pages": 3
    }
  }
  ```

### 16. Get Band Details (Admin)
- **GET** `/hardware/bands/:serial_number`
- **Auth:** Admin only
- **Params:** `serial_number` (string)
- **Response (200):**
  ```json
  {
    "_id": "60d5f1a9c1234567890abce1",
    "serial_number": "BAND-001",
    "imei": "358938070000000",
    "battery_percent": 85,
    "status": "active",
    "current_user_id": {
      "_id": "60d5ec49c1234567890abce0",
      "full_name": "Ahmed Hassan",
      "email": "ahmed@example.com",
      "phone_number": "+201234567890"
    },
    "last_latitude": 21.4225,
    "last_longitude": 39.8262,
    "last_updated": "2024-01-26T15:45:30Z"
  }
  ```

### 17. Deactivate Band (Admin)
- **DELETE** `/hardware/bands/:serial_number`
- **Auth:** Admin only
- **Params:** `serial_number` (string)
- **Response (200):**
  ```json
  {
    "message": "Band deactivated successfully",
    "band": {
      "_id": "60d5f1a9c1234567890abce1",
      "serial_number": "BAND-001",
      "imei": "358938070000000",
      "battery_percent": 85,
      "status": "inactive",
      "current_user_id": null,
      "last_latitude": 21.4225,
      "last_longitude": 39.8262,
      "last_updated": "2024-01-26T15:45:30Z"
    }
  }
  ```

### 17.5 Permanently Delete Band (Admin)
- **DELETE** `/hardware/bands/:serial_number/force`
- **Auth:** Admin only
- **Params:** `serial_number` (string)
- **Description:** Permanently deletes a hardware band from the database. This action cannot be undone.
- **Response (200):**
  ```json
  {
    "message": "Band with serial number BAND-001 has been permanently deleted."
  }
  ```

### 17.6 Activate Band (Admin)
- **POST** `/hardware/bands/:serial_number/activate`
- **Auth:** Admin only
- **Params:** `serial_number` (string)
- **Description:** Activates a hardware band, setting its status to 'active'.
- **Response (200):**
  ```json
  {
    "message": "Band activated successfully",
    "band": {
      "_id": "60d5f1a9c1234567890abce1",
      "serial_number": "BAND-001",
      "imei": "358938070000000",
      "battery_percent": 85,
      "status": "active",
      "current_user_id": null,
      "last_latitude": null,
      "last_longitude": null,
      "last_updated": null
    }
  }
  ```

---

## 👨‍💼 Admin Endpoints (`/admin`)

**All admin routes require authentication with admin role**

### 18. Get All Users
- **GET** `/admin/users?page=1&limit=50&role=moderator`
- **Auth:** Admin only
- **Rate Limit:** 100 requests per 15 minutes
- **Description:** List all users (admins/moderators) or pilgrims in the system with optional role filtering (paginated). If no role is provided, it returns users.
- **Query Parameters:**
  - `page` (optional): Page number, default = 1
  - `limit` (optional): Items per page, default = 50, max = 100
  - `role` (optional): Filter by role - `admin`, `moderator`, or `pilgrim`
- **Examples:**
  ```bash
  # Get all moderators
  GET /api/admin/users?role=moderator&page=1&limit=30
  
  # Get all pilgrims
  GET /api/admin/users?role=pilgrim&page=2&limit=50
  ```
- **Response (200):**
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "60d5ec49c1234567890abcde",
        "full_name": "Ahmed Hassan",
        "email": "ahmed@example.com",
        "phone_number": "+201234567890",
        "role": "moderator",
        "active": true,
        "created_at": "2024-01-20T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 25,
      "pages": 1
    }
  }
  ```

### 19. Get All Groups
- **GET** `/admin/groups?page=1&limit=30`
- **Auth:** Admin only
- **Rate Limit:** 100 requests per 15 minutes
- **Description:** List all groups in the system with moderator/creator details (paginated).
- **Query Parameters:**
  - `page` (optional): Page number, default = 1
  - `limit` (optional): Items per page, default = 30, max = 100
- **Response (200):**
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "60d5f1a9c1234567890abcdf",
        "group_name": "Hajj Group A",
        "created_by": {
          "_id": "60d5ec49c1234567890abcde",
          "full_name": "Ahmed Hassan"
        },
        "moderator_ids": ["60d5ec49c1234567890abcde"],
        "pilgrim_count": 5,
        "created_at": "2024-01-20T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 30,
      "total": 12,
      "pages": 1
    }
  }
  ```

### 19.5 Permanently Delete Group (Admin)
- **DELETE** `/admin/groups/:group_id`
- **Auth:** Admin only
- **Params:** `group_id` (MongoDB ID)
- **Description:** Permanently deletes a group from the database. This action cannot be undone.
- **Response (200):**
  ```json
  {
    "message": "Group with ID 60d5f1a9c1234567890abcdf has been permanently deleted."
  }
  ```
- **Error (404):**
  ```json
  {
    "message": "Group not found"
  }
  ```

   - **Validation:** The server validates that all provided `band_ids` exist. If any IDs are missing, the response will be HTTP 404 with a `missing` array listing the non-existent IDs.

### 19.6 Assign Bands to Group
- **POST** `/admin/groups/:group_id/assign-bands`
- **Auth:** Admin only
- **Params:** `group_id` (MongoDB ID)
- **Description:** Assign a list of bands to a group, making them available for assignment to pilgrims within that group.
- **Body:**
  ```json
  {
    "band_ids": ["60d5ec49c1234567890abce1", "60d5ec49c1234567890abce2"]
  }
  ```
- **Response (200):**
  ```json
  {
    "message": "Bands assigned to group successfully",
    "group": {
      "_id": "60d5f1a9c1234567890abcdf",
      "group_name": "Hajj Group A",
      "moderator_ids": ["60d5ec49c1234567890abcde"],
      "pilgrim_ids": ["60d5ec49c1234567890abcf0"],
      "available_band_ids": ["60d5ec49c1234567890abce1", "60d5ec49c1234567890abce2"]
    }
  }
  ```

### 19.7 Unassign Bands from Group
- **POST** `/admin/groups/:group_id/unassign-bands`
- **Auth:** Admin only
- **Params:** `group_id` (MongoDB ID)
- **Description:** Unassign a list of bands from a group.
- **Body:**
  ```json
  {
    "band_ids": ["60d5ec49c1234567890abce1"]
  }
  ```
- **Response (200):**
  ```json
  {
    "message": "Bands unassigned from group successfully",
    "group": {
      "_id": "60d5f1a9c1234567890abcdf",
      "group_name": "Hajj Group A",
      "moderator_ids": ["60d5ec49c1234567890abcde"],
      "pilgrim_ids": ["60d5ec49c1234567890abcf0"],
      "available_band_ids": ["60d5ec49c1234567890abce2"]
    }
  }
  ```

### 20. Get System Statistics
- **GET** `/admin/stats`
- **Auth:** Admin only
- **Rate Limit:** 100 requests per 15 minutes
- **Description:** Retrieve overall system statistics (user counts, group stats, band data).
- **Response (200):**
  ```json
  {
    "success": true,
    "stats": {
      "total_users": 150,
      "admins": 2,
      "moderators": 25,
      "pilgrims": 123,
      "active_users": 145,
      "inactive_users": 5,
      "total_groups": 12,
      "avg_pilgrims_per_group": 10.25,
      "total_bands": 120,
      "active_bands": 115,
      "maintenance_bands": 3,
      "inactive_bands": 2,
      "assigned_bands": 115,
      "unassigned_bands": 5
    }
  }
  ```

### 21. Promote to Admin
- **POST** `/admin/users/promote-to-admin`
- **Auth:** Admin only
- **Rate Limit:** 100 requests per 15 minutes
- **Description:** Elevate a moderator to admin role.
- **Body:**
  ```json
  {
    "user_id": "60d5ec49c1234567890abcde"
  }
  ```
- **Response (200):**
  ```json
  {
    "success": true,
    "message": "User promoted to admin",
    "user": {
      "_id": "60d5ec49c1234567890abcde",
      "full_name": "Ahmed Hassan",
      "role": "admin"
    }
  }
  ```

### 22. Demote to Moderator
- **POST** `/admin/users/demote-to-moderator`
- **Auth:** Admin only
- **Rate Limit:** 100 requests per 15 minutes
- **Description:** Remove admin privileges and revert to moderator.
- **Body:**
  ```json
  {
    "user_id": "60d5ec49c1234567890abcde"
  }
  ```
- **Response (200):**
  ```json
  {
    "success": true,
    "message": "User demoted to moderator",
    "user": {
      "_id": "60d5ec49c1234567890abcde",
      "full_name": "Ahmed Hassan",
      "role": "moderator"
    }
  }
  ```

### 22.5 Demote to Pilgrim
- **POST** `/admin/users/demote-to-pilgrim`
- **Auth:** Admin only
- **Rate Limit:** 100 requests per 15 minutes
- **Description:** Demote a moderator to a pilgrim. This will create a new pilgrim and delete the user.
- **Body:**
  ```json
  {
    "user_id": "60d5ec49c1234567890abcde"
  }
  ```
- **Response (200):**
  ```json
  {
    "success": true,
    "message": "User demoted to pilgrim",
    "pilgrim_id": "60d5ec49c1234567890abcf0"
  }
  ```

### 23. Deactivate User
- **POST** `/admin/users/deactivate`
- **Auth:** Admin only
- **Rate Limit:** 100 requests per 15 minutes
- **Description:** Deactivate a user or pilgrim account (prevents login for users).
- **Body:**
  ```json
  {
    "user_id": "60d5ec49c1234567890abcde"
  }
  ```
- **Response (200):**
  ```json
  {
    "success": true,
    "message": "User deactivated",
    "user": {
      "_id": "60d5ec49c1234567890abcde",
      "active": false
    }
  }
  ```

### 24. Activate User
- **POST** `/admin/users/activate`
- **Auth:** Admin only
- **Rate Limit:** 100 requests per 15 minutes
- **Description:** Reactivate a deactivated user or pilgrim account.
- **Body:**
  ```json
  {
    "user_id": "60d5ec49c1234567890abcde"
  }
  ```
- **Response (200):**
  ```json
  {
    "success": true,
    "message": "User activated",
    "user": {
      "_id": "60d5ec49c1234567890abcde",
      "active": true
    }
  }
  ```

### 24.5 Permanently Delete User (Admin)
- **DELETE** `/admin/users/:user_id/force`
- **Auth:** Admin only
- **Params:** `user_id` (MongoDB ID)
- **Description:** Permanently deletes a user or pilgrim from the database. This action also removes the user from any groups and unassigns any bands. This action cannot be undone.
- **Response (200):**
  ```json
  {
    "message": "User with ID 60d5ec49c1234567890abcde has been permanently deleted."
  }
  ```

---

## Error Responses

All error responses follow this format:

### 400 Bad Request
```json
{
  "errors": [
    "full_name must be at least 3 characters long",
    "email is required"
  ]
}
```

### 401 Unauthorized
```json
{
  "message": "Not authorized"
}
```

### 403 Forbidden
```json
{
  "message": "Role moderator is not authorized to access this route"
}
```

### 404 Not Found
```json
{
  "message": "Band not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error message"
}
```

---

## User Roles

- **admin**: Full access to all endpoints (manage users, bands, groups).
- **moderator**: Can manage groups, search & register pilgrims, assign bands, send alerts.
- **pilgrim**: A separate entity representing a pilgrim. Cannot login. Identified by national_id and wristband assignment. Used for tracking.

---


## Typical Workflow

### For Moderators:
1. **Register** via `/auth/register` (automatically becomes moderator)
2. **Login** to get JWT token
3. **Register pilgrims** via `/auth/register-pilgrim` (just name, national_id, medical info)
4. **Search pilgrims** via `/auth/search-pilgrims` to find existing ones
5. **Create a group** via `/groups/create`
6. **Add pilgrims** to group via `/groups/:group_id/add-pilgrim`
7. **Register hardware bands** as admin via `/hardware/register`
8. **Assign bands** to pilgrims via `/groups/assign-band`
9. **Monitor group** via `/groups/dashboard` (sees all pilgrims and their live locations)
10. **Send alerts** via `/groups/send-alert`

### For Wristbands:
- Send GPS data to `/hardware/ping` (public endpoint, no auth needed)
- Include: `serial_number`, `lat`, `lng`

---


## Notes
- Tokens expire in 24 hours
- Passwords are hashed using bcryptjs
- Locations are updated in real-time by wristbands
- Groups can have multiple moderators and pilgrims
- Pilgrims don't have passwords and are identified by national_id
- **Default signup role is moderator** - all registered users can immediately manage groups and pilgrims
- **Phone numbers are unique** - each user must have a unique phone number
- **Group names are unique per moderator** - a moderator cannot create two groups with the same name
- **Moderators cannot add themselves as pilgrims** - moderator/pilgrim roles are separate
- **Multiple moderators** - groups can have multiple moderators managing the same pilgrims
- **Rate Limiting:** All endpoints are protected. Exceeding limits returns HTTP 429 with error message
- **Pagination:** List endpoints support page and limit query parameters. Default limits vary per endpoint (20-50)
- **Admin Panel:** Admin users can manage other users, view all groups, access system statistics
- **User Deactivation:** Admins can deactivate users without deleting data. Deactivated users cannot login
