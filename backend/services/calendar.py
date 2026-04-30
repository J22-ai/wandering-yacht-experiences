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
            ticket_lines.append(f"  {t['ticket_name']} x{t['quantity']}")
        ticket_summary = "\n".join(ticket_lines)

        description = (
            f"BOOKING CONFIRMED — {payment_label}\n\n"
            f"Customer: {customer_name}\n"
            f"Email: {customer_email}\n"
            f"Tickets: {ticket_summary}\n"
            f"Total: €{booking['total_amount']:.2f}"
            f"{deposit_info}\n"
            f"Location: {booking.get('experience_location', 'TBD')}\n"
        )

        experience_date_str = booking.get('experience_date', '')
        try:
            event_date = datetime.strptime(experience_date_str, "%Y-%m-%d")
        except (ValueError, TypeError):
            event_date = datetime.utcnow()

        # Use the actual time slot if available, otherwise default to 09:00
        time_slot_id = booking.get('time_slot_id')
        start_hour = 9
        start_minute = 0
        end_hour = None
        
        if time_slot_id and experience.get('time_slots'):
            for slot in experience['time_slots']:
                if slot.get('id') == time_slot_id:
                    try:
                        start_parts = slot['start_time'].split(':')
                        start_hour = int(start_parts[0])
                        start_minute = int(start_parts[1]) if len(start_parts) > 1 else 0
                        end_parts = slot['end_time'].split(':')
                        end_hour = int(end_parts[0])
                    except (KeyError, ValueError, IndexError):
                        pass
                    break

        duration_hours = experience.get('duration_hours', 4) or 4
        if end_hour is None:
            end_hour = start_hour + int(duration_hours)
        
        event_title = f"\U0001f6a2 {booking['experience_title']} \u2014 {customer_name}"

        start_time_str = f"{start_hour:02d}:{start_minute:02d}:00"
        end_time_str = f"{end_hour:02d}:{start_minute:02d}:00"

        event_body = {
            'summary': event_title,
            'description': description,
            'location': booking.get('experience_location', ''),
            'start': {
                'dateTime': event_date.strftime(f'%Y-%m-%dT{start_time_str}'),
                'timeZone': 'Europe/Podgorica',
            },
            'end': {
                'dateTime': event_date.strftime(f'%Y-%m-%dT{end_time_str}'),
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
