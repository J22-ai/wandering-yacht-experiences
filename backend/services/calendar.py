import logging
from datetime import datetime, timedelta
from google.oauth2 import service_account
from googleapiclient.discovery import build
from config import GOOGLE_CALENDAR_ID, GOOGLE_CREDENTIALS_PATH

logger = logging.getLogger(__name__)


def get_google_calendar_service():
    """Authenticate and return a Google Calendar API service instance."""
    try:
        SCOPES = ['https://www.googleapis.com/auth/calendar']
        credentials = service_account.Credentials.from_service_account_file(
            str(GOOGLE_CREDENTIALS_PATH),
            scopes=SCOPES
        )
        service = build('calendar', 'v3', credentials=credentials)
        return service
    except Exception as e:
        logger.error(f"Failed to create Google Calendar service: {e}")
        return None


def create_calendar_event(booking: dict, experience: dict, customer_name: str, customer_email: str):
    """Create a Google Calendar event for a confirmed booking."""
    try:
        service = get_google_calendar_service()
        if not service:
            logger.error("Google Calendar service unavailable — skipping event creation.")
            return None

        is_deposit = booking.get('payment_type') == 'deposit'
        payment_label = "DEPOSIT PAID" if is_deposit else "FULLY PAID"
        deposit_info = ""
        if is_deposit:
            deposit_info = (
                f"\n\U0001f4b0 Deposit ({int(booking.get('deposit_percentage', 30))}%): \u20ac{booking.get('deposit_amount', 0):.2f}"
                f"\n\u23f3 Remaining Balance: \u20ac{booking.get('remaining_balance', 0):.2f}"
            )

        ticket_lines = []
        for t in booking.get('tickets', []):
            ticket_lines.append(f"  \u2022 {t['ticket_name']} x{t['quantity']} @ \u20ac{t['price_per_ticket']:.2f}")
        ticket_summary = "\n".join(ticket_lines)

        description = (
            f"\U0001f3ab BOOKING CONFIRMED \u2014 {payment_label}\n"
            f"\u2501" * 24 + "\n"
            f"\U0001f4cb Booking ID: {booking['id'][:8].upper()}\n"
            f"\U0001f464 Customer: {customer_name}\n"
            f"\U0001f4e7 Email: {customer_email}\n"
            f"\n\U0001f39f\ufe0f Tickets:\n{ticket_summary}\n"
            f"\n\U0001f4b6 Total: \u20ac{booking['total_amount']:.2f}"
            f"{deposit_info}\n"
            f"\n\U0001f4cd Location: {booking.get('experience_location', 'TBD')}\n"
            f"\u2501" * 24 + "\n"
            f"Special Requests: {booking.get('special_requests', 'None')}\n"
        )

        experience_date_str = booking.get('experience_date', '')
        try:
            event_date = datetime.strptime(experience_date_str, "%Y-%m-%d")
        except (ValueError, TypeError):
            event_date = datetime.utcnow()

        duration_hours = experience.get('duration_hours', 4) or 4
        event_title = f"\U0001f6a2 {booking['experience_title']} \u2014 {customer_name}"

        event_body = {
            'summary': event_title,
            'description': description,
            'location': booking.get('experience_location', ''),
            'start': {
                'dateTime': event_date.strftime('%Y-%m-%dT09:00:00'),
                'timeZone': 'Europe/Podgorica',
            },
            'end': {
                'dateTime': event_date.replace(hour=9).strftime('%Y-%m-%dT') + f"{9 + int(duration_hours):02d}:00:00",
                'timeZone': 'Europe/Podgorica',
            },
            'colorId': '9' if is_deposit else '10',
            'reminders': {
                'useDefault': False,
                'overrides': [
                    {'method': 'popup', 'minutes': 60 * 24},
                    {'method': 'popup', 'minutes': 120},
                ],
            },
        }

        created_event = service.events().insert(
            calendarId=GOOGLE_CALENDAR_ID,
            body=event_body
        ).execute()

        logger.info(f"Google Calendar event created: {created_event.get('id')} for booking {booking['id'][:8]}")
        return created_event.get('id')

    except Exception as e:
        logger.error(f"Failed to create Google Calendar event: {e}")
        return None
