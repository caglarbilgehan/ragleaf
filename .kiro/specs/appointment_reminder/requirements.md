# Spec: Appointment Reminder Requirements (GÖREV-8)

## Overview
The automated appointment reminder system sends reminders to customers via SMS or Email at specified intervals before their appointments.

## Requirements

1. **Intervals**:
   - The system must support three intervals:
     - 1 day before (Region A: 2 to 24 hours before appointment)
     - 1 hour before (Region B: 45 minutes to 2 hours before appointment)
     - 30 minutes before (Region C: 0 to 45 minutes before appointment)

2. **Communication Channels**:
   - **Email**: Send via SMTP with globally defined environment variable credentials.
   - **SMS**: Send via Twilio or NetGSM APIs.
   - **Mock/Dummy Fallback**: If no credentials are provided in `.env`, write reminders to a log/stdout for development/test purposes.

3. **Multi-Tenancy**:
   - Reminders are customizable per Organization.
   - Default settings are applied if custom templates/flags are not defined in `Organization.settings`.
   - Settings structure under `Organization.settings`:
     ```json
     {
       "notifications": {
         "email_enabled": true,
         "sms_enabled": true,
         "email_template": "Sayın {customer_name}, {appointment_date} tarihindeki {service_type} randevunuzu hatırlatmak isteriz.",
         "sms_template": "Hatırlatma: {organization_name} - {appointment_date} {service_type} randevunuz."
       }
     }
     ```

4. **Reliability & Idempotency**:
   - Reminders must be sent exactly once per interval.
   - Log sent reminders in `appointment.extra_data["sent_reminders"]` (e.g., `["1d", "1h", "30m"]`).
   - Do not send outdated or skipped reminders.

5. **Background Task**:
   - A background scheduler loop should run every 60 seconds.
   - Integrate using FastAPI's modern lifespan handler to start and stop gracefully.
