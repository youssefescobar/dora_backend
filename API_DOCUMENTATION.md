# Doora SmartBand API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication
All protected routes require a JWT token in the `Authorization` header:
```
Authorization: Bearer <token>
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
- **Description:** Quickly register pilgrims without needing email/password. Used by moderators to onboard pilgrims.
- **Body:**
  ```json
  {
    "full_name": "Ahmed Hassan",
    "national_id": "123456789",
    "medical_history": "Diabetic, takes insulin daily",
    "email": "ahmed@example.com"
  }
  ```
- **Response (201):**
  ```json
  {
    "message": "Pilgrim registered successfully",
    "pilgrim_id": "60d5ec49c1234567890abce0",
    "national_id": "123456789"
  }
  ```
- **Note:** Pilgrims don't require a password and cannot login to the app. They are identified by their national ID and wristband assignment.

### 6. Search Pilgrims (Admin/Moderator)
- **GET** `/auth/search-pilgrims?query=<search_term>`
- **Auth:** Moderator or Admin only
- **Description:** Search for pilgrims by national ID or full name. Returns up to 20 results.
- **Query Parameters:**
  - `query` (required): Search term (national ID or name, case-insensitive)
- **Examples:**
  ```bash
  # Search by national ID
  GET /api/auth/search-pilgrims?query=123456789
  
  # Search by name
  GET /api/auth/search-pilgrims?query=Ahmed
  ```
- **Response (200):**
  ```json
  {
    "count": 2,
    "pilgrims": [
      {
        "_id": "60d5ec49c1234567890abce0",
        "full_name": "Ahmed Hassan",
        "national_id": "123456789",
        "email": "ahmed@example.com",
        "phone_number": "+201234567890",
        "medical_history": "Diabetic, takes insulin daily"
      },
      {
        "_id": "60d5ec49c1234567890abce1",
        "full_name": "Ahmed Ali",
        "national_id": "987654321",
        "email": "ahmed.ali@example.com",
        "phone_number": "+201987654321",
        "medical_history": null
      }
    ]
  }
  ```

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
- **GET** `/groups/dashboard`
- **Auth:** Moderator or Admin
- **Response (200):**
  ```json
  [
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
          "band_info": {
            "serial_number": "BAND-001",
            "last_location": {
              "lat": 21.4225,
              "lng": 39.8262
            },
            "last_updated": "2024-01-26T15:30:00Z"
          }
        }
      ]
    }
  ]
  ```

### 9. Add Pilgrim to Group
- **POST** `/groups/:group_id/add-pilgrim`
- **Auth:** Moderator or Admin
- **Params:** `group_id` (MongoDB ID)
- **Description:** Add a pilgrim to a group. A moderator cannot add themselves as a pilgrim.
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
          "national_id": "123456789"
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
- **Description:** Assign a hardware band to a pilgrim. Validates both pilgrim and band exist.
- **Body:**
  ```json
  {
    "serial_number": "BAND-001",
    "user_id": "60d5ec49c1234567890abce0"
  }
  ```
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
  - 404: Pilgrim or band not found
  - 400: User is not a pilgrim

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

---

## 📡 Hardware Band Endpoints (`/hardware`)

### 13. Report Location (Public)
- **POST** `/hardware/ping`
- **Public** (No auth required - for wristband use)
- **Body:**
  ```json
  {
    "serial_number": "BAND-001",
    "lat": 21.4225,
    "lng": 39.8262
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
    "imei": "358938070000001"
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
      "status": "active",
      "current_user_id": null,
      "last_latitude": null,
      "last_longitude": null,
      "last_updated": null
    }
  }
  ```

### 15. Get All Bands (Admin)
- **GET** `/hardware/bands`
- **Auth:** Admin only
- **Response (200):**
  ```json
  [
    {
      "_id": "60d5f1a9c1234567890abce1",
      "serial_number": "BAND-001",
      "imei": "358938070000000",
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
  ]
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
      "status": "inactive",
      "current_user_id": null,
      "last_latitude": 21.4225,
      "last_longitude": 39.8262,
      "last_updated": "2024-01-26T15:45:30Z"
    }
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

- **admin**: Full access to all endpoints (manage users, bands, groups)
- **moderator**: Can manage groups, search & register pilgrims, assign bands, send alerts
- **pilgrim**: Cannot login. Identified by national_id and wristband assignment. Used for tracking.

---

## Typical Workflow

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

## Testing with cURL or Postman

### 1. Register a New User (defaults to pilgrim)
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "John Moderator",
    "email": "john@example.com",
    "password": "password123",
    "phone_number": "+201234567890"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

### 3. Register a Pilgrim (requires moderator role + token)
```bash
curl -X POST http://localhost:5000/api/auth/register-pilgrim \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "full_name": "Ahmed Hassan",
    "national_id": "123456789",
    "medical_history": "Diabetic, takes insulin",
    "email": "ahmed@example.com"
  }'
```

### 4. Search Pilgrims (requires moderator role + token)
```bash
# Search by national ID
curl -X GET "http://localhost:5000/api/auth/search-pilgrims?query=123456789" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Search by name
curl -X GET "http://localhost:5000/api/auth/search-pilgrims?query=Ahmed" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 5. Create a Group (use token from login)
```bash
curl -X POST http://localhost:5000/api/groups/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "group_name": "Hajj Group 2024"
  }'
```

### 6. Add Pilgrim to Group
```bash
curl -X POST http://localhost:5000/api/groups/GROUP_ID/add-pilgrim \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "user_id": "PILGRIM_USER_ID"
  }'
```

### 7. Assign Band to Pilgrim
```bash
curl -X POST http://localhost:5000/api/groups/assign-band \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "serial_number": "BAND-001",
    "user_id": "PILGRIM_USER_ID"
  }'
```

### 8. Wristband Report Location (no auth required)
```bash
curl -X POST http://localhost:5000/api/hardware/ping \
  -H "Content-Type: application/json" \
  -d '{
    "serial_number": "BAND-001",
    "lat": 21.4225,
    "lng": 39.8262
  }'
```

### 9. Send Group Alert
```bash
curl -X POST http://localhost:5000/api/groups/send-alert \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "group_id": "GROUP_ID",
    "message_text": "Please stay together at gate 5"
  }'
```

### 9.1 Send Individual Alert
```bash
curl -X POST http://localhost:5000/api/groups/send-individual-alert \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "user_id": "PILGRIM_USER_ID",
    "message_text": "Please return to meeting point"
  }'
```

### 10. Get Group Dashboard
```bash
curl -X GET http://localhost:5000/api/groups/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 11. Delete Group
```bash
curl -X DELETE http://localhost:5000/api/groups/GROUP_ID \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

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
