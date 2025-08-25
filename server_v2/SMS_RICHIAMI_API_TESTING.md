# SMS and Richiami API V2 Testing Guide

This document provides testing examples and curl commands for the newly implemented SMS and Richiami API endpoints in V2.

## Prerequisites

1. **Server Running**: Make sure Server V2 is running on the configured port (usually 5001)
2. **Authentication**: You need a valid JWT token from the `/v2/auth/login` endpoint
3. **Environment Variables**: Ensure SMS service is properly configured with Brevo API credentials

## Authentication

First, get your JWT token:

```bash
# Login to get JWT token
curl -X POST http://localhost:5001/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_username",
    "password": "your_password"
  }'

# Export the token for easier use
export JWT_TOKEN="your_jwt_token_here"
```

## SMS API Endpoints

### 1. Send Generic SMS

```bash
# Send a simple SMS
curl -X POST http://localhost:5001/v2/sms/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "recipient": "+393331234567",
    "message": "Test message from Studio Dima",
    "sender": "StudioDima"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message_id": "unique_message_id",
    "recipient": "+393331234567",
    "sender": "StudioDima",
    "environment": "test",
    "message": "SMS inviato con successo"
  },
  "message": "SMS inviato con successo",
  "state": "success"
}
```

### 2. Send Recall SMS

```bash
# Send SMS using richiamo data
curl -X POST http://localhost:5001/v2/sms/send-recall \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "richiamo_data": {
      "telefono": "+393331234567",
      "nome": "Mario Rossi",
      "tipo_richiamo": "1",
      "paziente_id": "12345"
    }
  }'

# Send SMS using richiamo ID
curl -X POST http://localhost:5001/v2/sms/send-recall \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "richiamo_id": 123
  }'

# Send SMS with custom message
curl -X POST http://localhost:5001/v2/sms/send-recall \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "richiamo_data": {
      "telefono": "+393331234567",
      "nome": "Mario Rossi",
      "tipo_richiamo": "1"
    },
    "custom_message": "Gentile Mario, la ricordiamo che è tempo per il suo controllo. Studio Dima"
  }'
```

### 3. Send Bulk SMS

```bash
# Send bulk generic SMS
curl -X POST http://localhost:5001/v2/sms/send-bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "type": "generic",
    "sms_list": [
      {
        "recipient": "+393331234567",
        "message": "Messaggio per il primo paziente"
      },
      {
        "recipient": "+393337654321",
        "message": "Messaggio per il secondo paziente"
      }
    ]
  }'

# Send bulk recall SMS
curl -X POST http://localhost:5001/v2/sms/send-bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "type": "recall",
    "richiami_list": [
      {
        "telefono": "+393331234567",
        "nome": "Mario Rossi",
        "tipo_richiamo": "1"
      },
      {
        "telefono": "+393337654321",
        "nome": "Anna Verdi",
        "tipo_richiamo": "2"
      }
    ]
  }'
```

### 4. Get SMS Service Status

```bash
# Check SMS service status and configuration
curl -X GET http://localhost:5001/v2/sms/status \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "environment": "test",
    "enabled": true,
    "api_key_configured": true,
    "sender": "StudioDima",
    "url": "https://api.brevo.com/v3/transactionalSMS/sms",
    "validation": {
      "valid": true,
      "errors": [],
      "warnings": [],
      "checks": {...}
    }
  },
  "message": "Status SMS recuperato con successo",
  "state": "success"
}
```

### 5. Test SMS Connection

```bash
# Test connection to Brevo API
curl -X POST http://localhost:5001/v2/sms/test \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### 6. Preview SMS Messages

```bash
# Preview recall SMS message
curl -X POST http://localhost:5001/v2/sms/preview \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "type": "recall",
    "richiamo_data": {
      "nome": "Mario Rossi",
      "tipo_richiamo": "1",
      "telefono": "+393331234567"
    }
  }'

# Preview generic SMS message
curl -X POST http://localhost:5001/v2/sms/preview \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "type": "generic",
    "message": "Your custom message here"
  }'
```

### 7. Get SMS Templates

```bash
# Get available SMS templates
curl -X GET http://localhost:5001/v2/sms/templates \
  -H "Authorization: Bearer $JWT_TOKEN"
```

## Richiami API Endpoints

### 1. Get Richiami List

```bash
# Get all richiami da fare
curl -X GET http://localhost:5001/v2/richiami \
  -H "Authorization: Bearer $JWT_TOKEN"

# Get richiami with filters
curl -X GET "http://localhost:5001/v2/richiami?days=30&status=S&limit=50" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Get richiami by type
curl -X GET "http://localhost:5001/v2/richiami?tipo=1&limit=20" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### 2. Get Richiami Da Fare (existing endpoint)

```bash
# Get richiami that need to be done
curl -X GET http://localhost:5001/v2/richiami/da-fare \
  -H "Authorization: Bearer $JWT_TOKEN"

# With limit
curl -X GET "http://localhost:5001/v2/richiami/da-fare?limit=10" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### 3. Get Richiami Statistics

```bash
# Get richiami statistics
curl -X GET http://localhost:5001/v2/richiami/statistiche \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "da_fare": 25,
    "scaduti": 8,
    "completati": 142,
    "totale": 175
  },
  "message": "Statistiche richiami recuperate con successo",
  "state": "success"
}
```

### 4. Get Richiamo Message

```bash
# Get message content for specific richiamo
curl -X GET http://localhost:5001/v2/richiami/123/message \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### 5. Update Richiamo Status

```bash
# Mark richiamo as completed (R)
curl -X PUT http://localhost:5001/v2/pazienti/PAZ001/richiamo/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "da_richiamare": "R",
    "data_richiamo": "2024-01-15"
  }'

# Mark richiamo as not needed (N)
curl -X PUT http://localhost:5001/v2/pazienti/PAZ001/richiamo/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "da_richiamare": "N"
  }'
```

### 6. Update Richiamo Configuration

```bash
# Update richiamo type and timing
curl -X PUT http://localhost:5001/v2/pazienti/PAZ001/richiamo/tipo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "tipo_richiamo": "2",
    "tempo_richiamo": 6
  }'
```

### 7. Mark Richiamo as Completed

```bash
# Mark specific richiamo as completed by ID
curl -X PUT http://localhost:5001/v2/richiami/123/completato \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### 8. Update Richiami Dates

```bash
# Recalculate richiamo dates based on patient data
curl -X POST http://localhost:5001/v2/richiami/update-dates \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### 9. Export Richiami

```bash
# Export richiami data
curl -X GET http://localhost:5001/v2/richiami/export \
  -H "Authorization: Bearer $JWT_TOKEN"

# Export with filters
curl -X GET "http://localhost:5001/v2/richiami/export?days=60&format=json" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### 10. Test Richiami System

```bash
# Test richiami functionality
curl -X GET http://localhost:5001/v2/richiami/test \
  -H "Authorization: Bearer $JWT_TOKEN"
```

## Integration Testing Scenarios

### Complete Richiamo Workflow

```bash
# 1. Get richiami da fare
curl -X GET http://localhost:5001/v2/richiami/da-fare \
  -H "Authorization: Bearer $JWT_TOKEN"

# 2. Get message preview for specific richiamo
curl -X GET http://localhost:5001/v2/richiami/123/message \
  -H "Authorization: Bearer $JWT_TOKEN"

# 3. Send SMS for richiamo
curl -X POST http://localhost:5001/v2/sms/send-recall \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "richiamo_id": 123
  }'

# 4. Mark richiamo as completed after patient contact
curl -X PUT http://localhost:5001/v2/richiami/123/completato \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Bulk SMS Workflow

```bash
# 1. Get list of richiami da fare
RICHIAMI=$(curl -X GET http://localhost:5001/v2/richiami/da-fare?limit=10 \
  -H "Authorization: Bearer $JWT_TOKEN")

# 2. Send bulk SMS for multiple richiami
curl -X POST http://localhost:5001/v2/sms/send-bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "type": "recall",
    "richiami_list": [
      {"telefono": "+393331234567", "nome": "Mario Rossi", "tipo_richiamo": "1"},
      {"telefono": "+393337654321", "nome": "Anna Verdi", "tipo_richiamo": "2"}
    ]
  }'
```

## Error Scenarios

### Test Error Handling

```bash
# Test with invalid phone number
curl -X POST http://localhost:5001/v2/sms/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "recipient": "invalid_phone",
    "message": "Test message"
  }'

# Test with missing richiamo data
curl -X POST http://localhost:5001/v2/sms/send-recall \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{}'

# Test with non-existent richiamo ID
curl -X GET http://localhost:5001/v2/richiami/999999/message \
  -H "Authorization: Bearer $JWT_TOKEN"
```

## Monitoring and Logs

To monitor the SMS and Richiami operations, check the server logs:

```bash
# View server logs
tail -f server_v2/logs/server_v2.log

# Filter for SMS-related logs
grep -i "sms" server_v2/logs/server_v2.log

# Filter for Richiami-related logs
grep -i "richiami" server_v2/logs/server_v2.log
```

## Environment Configuration

Make sure your environment variables are properly configured:

```bash
# Check environment configuration
curl -X GET http://localhost:5001/v2/environment/status \
  -H "Authorization: Bearer $JWT_TOKEN"

# Test SMS configuration specifically
curl -X POST http://localhost:5001/v2/sms/test \
  -H "Authorization: Bearer $JWT_TOKEN"
```

## Success Indicators

- **SMS Status**: `enabled: true` and `api_key_configured: true`
- **Test Connection**: Returns `success: true`
- **Richiami Statistics**: Returns valid counts for da_fare, scaduti, etc.
- **Message Preview**: Returns properly formatted messages with template variables

## Troubleshooting

1. **SMS Not Sending**: Check SMS status endpoint and verify Brevo API credentials
2. **Richiami Not Found**: Ensure richiami have been migrated from DBF using the migration endpoint
3. **Authentication Errors**: Verify JWT token is valid and not expired
4. **Template Errors**: Check available templates using the templates endpoint