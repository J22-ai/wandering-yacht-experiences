import logging
import base64
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from config import SMTP_HOST, SMTP_PORT, SMTP_EMAIL, SMTP_PASSWORD

logger = logging.getLogger(__name__)


def send_booking_email(to_email: str, customer_name: str, booking: dict, experience: dict):
    """Send booking confirmation email with QR code ticket"""
    try:
        is_deposit = booking.get('payment_type') == 'deposit'
        
        ticket_rows = ""
        for ticket in booking.get('tickets', []):
            ticket_rows += f"""
            <tr>
                <td style="padding:8px 0;border-bottom:1px solid #eee;font-family:Georgia,serif;color:#3a4a50;">{ticket['ticket_name']}</td>
                <td style="padding:8px 0;border-bottom:1px solid #eee;font-family:Georgia,serif;color:#3a4a50;text-align:center;">{ticket['quantity']}</td>
                <td style="padding:8px 0;border-bottom:1px solid #eee;font-family:Georgia,serif;color:#3a4a50;text-align:right;">€{ticket['price_per_ticket']:.2f}</td>
            </tr>"""
        
        deposit_html = ""
        if is_deposit:
            deposit_html = f"""
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;background:#f0f7f7;border-radius:12px;border:2px solid #1a3a4a;">
                <tr><td style="padding:16px 20px;background:#1a3a4a;border-radius:10px 10px 0 0;">
                    <p style="margin:0;color:#fff;font-family:Georgia,serif;font-size:15px;font-weight:bold;text-align:center;letter-spacing:1px;">DEPOSIT OF {int(booking.get('deposit_percentage', 30))}% RECEIVED</p>
                </td></tr>
                <tr><td style="padding:20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="padding:6px 0;font-family:Georgia,serif;color:#5a6a6a;">Charter Total</td>
                            <td style="padding:6px 0;font-family:Georgia,serif;color:#5a6a6a;text-align:right;">€{booking['total_amount']:.2f}</td>
                        </tr>
                        <tr style="background:#d4eaea;border-radius:8px;">
                            <td style="padding:10px 8px;font-family:Georgia,serif;color:#1a3a4a;font-weight:bold;">Deposit Paid</td>
                            <td style="padding:10px 8px;font-family:Georgia,serif;color:#1a3a4a;font-weight:bold;text-align:right;font-size:18px;">€{booking.get('deposit_amount', 0):.2f}</td>
                        </tr>
                        <tr>
                            <td style="padding:6px 0;font-family:Georgia,serif;color:#a0aab0;">Remaining Balance</td>
                            <td style="padding:6px 0;font-family:Georgia,serif;color:#a0aab0;text-align:right;">€{booking.get('remaining_balance', 0):.2f}</td>
                        </tr>
                    </table>
                    <p style="margin:12px 0 0;font-family:Georgia,serif;font-size:12px;color:#7a8a8a;text-align:center;">Your dates are now blocked. We will contact you regarding the remaining balance and itinerary details.</p>
                </td></tr>
            </table>"""
        
        qr_base64 = booking.get('qr_code', '')
        qr_img_data = None
        if qr_base64 and ',' in qr_base64:
            qr_img_data = base64.b64decode(qr_base64.split(',')[1])
        
        subject = f"{'Deposit Confirmation' if is_deposit else 'Booking Confirmation'} — {booking['experience_title']} | WANDERING YACHT"
        
        html_body = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f3f0;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3f0;">
<tr><td align="center" style="padding:20px 10px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <tr><td style="background:#1a3a4a;padding:30px 40px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-family:Georgia,serif;font-size:24px;letter-spacing:3px;">WANDERING</h1>
        <h1 style="margin:0;color:#fff;font-family:Georgia,serif;font-size:24px;letter-spacing:3px;">YACHT</h1>
        <p style="margin:10px 0 0;color:#c17f59;font-family:Georgia,serif;font-size:13px;letter-spacing:2px;">{'DEPOSIT CONFIRMATION' if is_deposit else 'BOOKING CONFIRMATION'}</p>
    </td></tr>
    <tr><td style="padding:30px 40px 10px;">
        <p style="margin:0;font-family:Georgia,serif;color:#1a3a4a;font-size:16px;">Dear {customer_name},</p>
        <p style="margin:10px 0 0;font-family:Georgia,serif;color:#5a6a6a;font-size:14px;line-height:22px;">
            {'Your deposit has been received and your dates are now secured.' if is_deposit else 'Thank you for your booking. Your experience has been confirmed.'}
        </p>
    </td></tr>
    <tr><td style="padding:10px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7;border-radius:12px;border:1px solid #ebe8e3;">
            <tr><td style="padding:20px;">
                <h2 style="margin:0 0 12px;font-family:Georgia,serif;color:#1a3a4a;font-size:18px;">{booking['experience_title']}</h2>
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr><td style="padding:4px 0;font-family:Georgia,serif;color:#7a8a8a;font-size:13px;">📍 Location</td>
                        <td style="padding:4px 0;font-family:Georgia,serif;color:#3a4a50;font-size:13px;text-align:right;">{booking['experience_location']}</td></tr>
                    <tr><td style="padding:4px 0;font-family:Georgia,serif;color:#7a8a8a;font-size:13px;">📅 Date</td>
                        <td style="padding:4px 0;font-family:Georgia,serif;color:#3a4a50;font-size:13px;text-align:right;">{booking['experience_date']}</td></tr>
                    <tr><td style="padding:4px 0;font-family:Georgia,serif;color:#7a8a8a;font-size:13px;">🎫 Booking ID</td>
                        <td style="padding:4px 0;font-family:Georgia,serif;color:#3a4a50;font-size:13px;text-align:right;">{booking['id'][:8].upper()}</td></tr>
                </table>
            </td></tr>
        </table>
    </td></tr>
    <tr><td style="padding:10px 40px;">
        <h3 style="margin:0 0 10px;font-family:Georgia,serif;color:#1a3a4a;font-size:14px;letter-spacing:1px;">TICKETS</h3>
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr style="border-bottom:2px solid #1a3a4a;">
                <th style="padding:8px 0;font-family:Georgia,serif;color:#1a3a4a;font-size:12px;text-align:left;">Type</th>
                <th style="padding:8px 0;font-family:Georgia,serif;color:#1a3a4a;font-size:12px;text-align:center;">Qty</th>
                <th style="padding:8px 0;font-family:Georgia,serif;color:#1a3a4a;font-size:12px;text-align:right;">Price</th>
            </tr>
            {ticket_rows}
            <tr>
                <td colspan="2" style="padding:12px 0;font-family:Georgia,serif;color:#1a3a4a;font-size:16px;font-weight:bold;">Total</td>
                <td style="padding:12px 0;font-family:Georgia,serif;color:#1a3a4a;font-size:20px;font-weight:bold;text-align:right;">€{booking['total_amount']:.2f}</td>
            </tr>
        </table>
    </td></tr>
    {deposit_html}
    <tr><td style="padding:20px 40px;text-align:center;">
        <p style="margin:0 0 10px;font-family:Georgia,serif;color:#1a3a4a;font-size:14px;letter-spacing:1px;font-weight:bold;">YOUR TICKET</p>
        <p style="margin:0 0 16px;font-family:Georgia,serif;color:#7a8a8a;font-size:12px;">Present this QR code upon arrival</p>
        {'<img src="cid:qrcode" width="180" height="180" style="border-radius:12px;border:1px solid #eee;" />' if qr_img_data else ''}
    </td></tr>
    <tr><td style="background:#1a3a4a;padding:24px 40px;text-align:center;">
        <p style="margin:0;color:#c17f59;font-family:Georgia,serif;font-size:12px;letter-spacing:1px;">WANDERING YACHT</p>
        <p style="margin:6px 0 0;color:#8a9a9a;font-family:Georgia,serif;font-size:11px;">Montenegro • Croatia • Albania • Greece</p>
        <p style="margin:8px 0 0;color:#8a9a9a;font-family:Georgia,serif;font-size:11px;">info@wanderingyacht.com</p>
    </td></tr>
</table></td></tr></table></body></html>"""
        
        msg = MIMEMultipart('related')
        msg['Subject'] = subject
        msg['From'] = f'WANDERING YACHT <{SMTP_EMAIL}>'
        msg['To'] = to_email
        html_part = MIMEText(html_body, 'html')
        msg.attach(html_part)
        if qr_img_data:
            img_part = MIMEImage(qr_img_data, name='qrcode.png')
            img_part.add_header('Content-ID', '<qrcode>')
            img_part.add_header('Content-Disposition', 'inline', filename='qrcode.png')
            msg.attach(img_part)
        
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.send_message(msg)
        
        logger.info(f"Booking confirmation email sent to {to_email} for booking {booking['id']}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False


def send_business_invoice(customer_name: str, customer_email: str, booking: dict, experience: dict, payment_label: str = "Payment"):
    """Send invoice copy to booking@wanderingyacht.com for every payment received."""
    try:
        is_deposit = booking.get('payment_type') == 'deposit'
        amount_paid = booking.get('deposit_amount', 0) if is_deposit else booking['total_amount']
        
        ticket_rows = ""
        for ticket in booking.get('tickets', []):
            ticket_rows += f"""
            <tr>
                <td style="padding:6px 0;border-bottom:1px solid #eee;font-family:Georgia,serif;color:#3a4a50;">{ticket['ticket_name']}</td>
                <td style="padding:6px 0;border-bottom:1px solid #eee;font-family:Georgia,serif;color:#3a4a50;text-align:center;">{ticket['quantity']}</td>
                <td style="padding:6px 0;border-bottom:1px solid #eee;font-family:Georgia,serif;color:#3a4a50;text-align:right;">€{ticket['price_per_ticket']:.2f}</td>
            </tr>"""

        deposit_section = ""
        if is_deposit:
            deposit_section = f"""
            <tr><td style="padding:10px 30px;background:#fff8e1;">
                <table width="100%">
                    <tr><td style="font-family:Georgia,serif;color:#e67e22;font-weight:bold;">⚠ DEPOSIT ONLY ({int(booking.get('deposit_percentage', 30))}%)</td></tr>
                    <tr><td style="font-family:Georgia,serif;color:#555;padding-top:6px;">
                        Deposit Paid: <b>€{booking.get('deposit_amount', 0):.2f}</b><br/>
                        Remaining Balance Due: <b>€{booking.get('remaining_balance', 0):.2f}</b>
                    </td></tr>
                </table>
            </td></tr>"""

        balance_paid_section = ""
        if payment_label == "Balance Payment":
            balance_paid_section = f"""
            <tr><td style="padding:10px 30px;background:#e8f5e9;">
                <table width="100%">
                    <tr><td style="font-family:Georgia,serif;color:#2e7d32;font-weight:bold;">✅ BALANCE PAYMENT RECEIVED</td></tr>
                    <tr><td style="font-family:Georgia,serif;color:#555;padding-top:6px;">
                        Balance Paid: <b>€{booking.get('remaining_balance', 0):.2f}</b><br/>
                        Total Charter Value: <b>€{booking['total_amount']:.2f}</b><br/>
                        Status: <b>FULLY PAID</b>
                    </td></tr>
                </table>
            </td></tr>"""

        subject = f"💰 {payment_label} — {booking['experience_title']} — {customer_name} | €{amount_paid:.2f}"

        html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0;">
<tr><td align="center" style="padding:20px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;border:1px solid #ddd;">
    <tr><td style="background:#1a3a4a;padding:20px 30px;">
        <h2 style="margin:0;color:#fff;font-size:18px;letter-spacing:2px;">WANDERING YACHT — INVOICE</h2>
        <p style="margin:4px 0 0;color:#c17f59;font-size:12px;letter-spacing:1px;">{payment_label.upper()}</p>
    </td></tr>
    <tr><td style="padding:20px 30px;">
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-family:Georgia,serif;color:#888;font-size:12px;padding:4px 0;">Customer</td>
                <td style="font-family:Georgia,serif;color:#333;font-size:14px;text-align:right;padding:4px 0;">{customer_name}</td></tr>
            <tr><td style="font-family:Georgia,serif;color:#888;font-size:12px;padding:4px 0;">Email</td>
                <td style="font-family:Georgia,serif;color:#333;font-size:14px;text-align:right;padding:4px 0;">{customer_email}</td></tr>
            <tr><td style="font-family:Georgia,serif;color:#888;font-size:12px;padding:4px 0;">Booking ID</td>
                <td style="font-family:Georgia,serif;color:#333;font-size:14px;text-align:right;padding:4px 0;">{booking['id'][:8].upper()}</td></tr>
            <tr><td style="font-family:Georgia,serif;color:#888;font-size:12px;padding:4px 0;">Experience</td>
                <td style="font-family:Georgia,serif;color:#333;font-size:14px;text-align:right;padding:4px 0;">{booking['experience_title']}</td></tr>
            <tr><td style="font-family:Georgia,serif;color:#888;font-size:12px;padding:4px 0;">Date</td>
                <td style="font-family:Georgia,serif;color:#333;font-size:14px;text-align:right;padding:4px 0;">{booking['experience_date']}</td></tr>
            <tr><td style="font-family:Georgia,serif;color:#888;font-size:12px;padding:4px 0;">Location</td>
                <td style="font-family:Georgia,serif;color:#333;font-size:14px;text-align:right;padding:4px 0;">{booking['experience_location']}</td></tr>
        </table>
    </td></tr>
    <tr><td style="padding:10px 30px;">
        <h3 style="margin:0 0 8px;color:#1a3a4a;font-size:13px;letter-spacing:1px;">TICKETS</h3>
        <table width="100%" cellpadding="0" cellspacing="0">{ticket_rows}
            <tr>
                <td colspan="2" style="padding:10px 0;font-family:Georgia,serif;color:#1a3a4a;font-weight:bold;font-size:16px;">Total</td>
                <td style="padding:10px 0;font-family:Georgia,serif;color:#1a3a4a;font-weight:bold;font-size:18px;text-align:right;">€{booking['total_amount']:.2f}</td>
            </tr>
        </table>
    </td></tr>
    {deposit_section}
    {balance_paid_section}
    <tr><td style="padding:10px 30px;background:#fafafa;border-top:1px solid #eee;">
        <table width="100%"><tr>
                <td style="font-family:Georgia,serif;color:#1a3a4a;font-weight:bold;font-size:16px;">AMOUNT RECEIVED</td>
                <td style="font-family:Georgia,serif;color:#2e7d32;font-weight:bold;font-size:22px;text-align:right;">€{amount_paid:.2f}</td>
        </tr></table>
    </td></tr>
    <tr><td style="padding:14px 30px;background:#1a3a4a;text-align:center;">
        <p style="margin:0;color:#8a9a9a;font-size:11px;">This is an automated invoice notification.</p>
    </td></tr>
</table></td></tr></table></body></html>"""

        msg = MIMEMultipart('related')
        msg['Subject'] = subject
        msg['From'] = f'WANDERING YACHT <{SMTP_EMAIL}>'
        msg['To'] = SMTP_EMAIL
        html_part = MIMEText(html, 'html')
        msg.attach(html_part)
        
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.send_message(msg)
        
        logger.info(f"Business invoice sent to {SMTP_EMAIL} for booking {booking['id'][:8]} — {payment_label}")
        return True
    except Exception as e:
        logger.error(f"Failed to send business invoice: {str(e)}")
        return False


def send_balance_request_email(to_email: str, customer_name: str, booking: dict, payment_url: str):
    """Send email requesting remaining balance payment."""
    try:
        remaining = booking.get('remaining_balance', 0)
        subject = f"Remaining Balance Due — {booking['experience_title']} | WANDERING YACHT"

        html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f3f0;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3f0;">
<tr><td align="center" style="padding:20px 10px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <tr><td style="background:#1a3a4a;padding:30px 40px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-family:Georgia,serif;font-size:24px;letter-spacing:3px;">WANDERING</h1>
        <h1 style="margin:0;color:#fff;font-family:Georgia,serif;font-size:24px;letter-spacing:3px;">YACHT</h1>
        <p style="margin:10px 0 0;color:#c17f59;font-family:Georgia,serif;font-size:13px;letter-spacing:2px;">BALANCE PAYMENT DUE</p>
    </td></tr>
    <tr><td style="padding:30px 40px;">
        <p style="margin:0;font-family:Georgia,serif;color:#1a3a4a;font-size:16px;">Dear {customer_name},</p>
        <p style="margin:12px 0 0;font-family:Georgia,serif;color:#5a6a6a;font-size:14px;line-height:24px;">
            Thank you for your deposit on <strong>{booking['experience_title']}</strong>. Your dates are secured and we are looking forward to hosting you.
        </p>
        <p style="margin:12px 0 0;font-family:Georgia,serif;color:#5a6a6a;font-size:14px;line-height:24px;">
            Please complete the remaining balance to confirm your full booking:
        </p>
    </td></tr>
    <tr><td style="padding:0 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7;border-radius:12px;border:1px solid #ebe8e3;">
            <tr><td style="padding:20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr><td style="padding:6px 0;font-family:Georgia,serif;color:#7a8a8a;font-size:13px;">Experience</td>
                        <td style="padding:6px 0;font-family:Georgia,serif;color:#1a3a4a;font-size:13px;text-align:right;font-weight:bold;">{booking['experience_title']}</td></tr>
                    <tr><td style="padding:6px 0;font-family:Georgia,serif;color:#7a8a8a;font-size:13px;">Date</td>
                        <td style="padding:6px 0;font-family:Georgia,serif;color:#1a3a4a;font-size:13px;text-align:right;">{booking['experience_date']}</td></tr>
                    <tr><td style="padding:6px 0;font-family:Georgia,serif;color:#7a8a8a;font-size:13px;">Booking ID</td>
                        <td style="padding:6px 0;font-family:Georgia,serif;color:#1a3a4a;font-size:13px;text-align:right;">{booking['id'][:8].upper()}</td></tr>
                    <tr><td style="padding:6px 0;font-family:Georgia,serif;color:#7a8a8a;font-size:13px;">Charter Total</td>
                        <td style="padding:6px 0;font-family:Georgia,serif;color:#1a3a4a;font-size:13px;text-align:right;">€{booking['total_amount']:.2f}</td></tr>
                    <tr><td style="padding:6px 0;font-family:Georgia,serif;color:#7a8a8a;font-size:13px;">Deposit Paid</td>
                        <td style="padding:6px 0;font-family:Georgia,serif;color:#2e7d32;font-size:13px;text-align:right;">-€{booking.get('deposit_amount', 0):.2f}</td></tr>
                </table>
            </td></tr>
            <tr><td style="padding:0 20px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a3a4a;border-radius:10px;">
                    <tr><td style="padding:16px 20px;">
                        <table width="100%"><tr>
                            <td style="font-family:Georgia,serif;color:#c17f59;font-size:14px;letter-spacing:1px;">REMAINING BALANCE</td>
                            <td style="font-family:Georgia,serif;color:#fff;font-size:24px;font-weight:bold;text-align:right;">€{remaining:.2f}</td>
                        </tr></table>
                    </td></tr>
                </table>
            </td></tr>
        </table>
    </td></tr>
    <tr><td style="padding:24px 40px;text-align:center;">
        <a href="{payment_url}" style="display:inline-block;background:#c17f59;color:#fff;font-family:Georgia,serif;font-size:16px;font-weight:bold;text-decoration:none;padding:16px 48px;border-radius:30px;letter-spacing:1px;">
            PAY REMAINING BALANCE
        </a>
    </td></tr>
    <tr><td style="padding:0 40px 20px;">
        <p style="margin:0;font-family:Georgia,serif;color:#5a6a6a;font-size:13px;line-height:22px;text-align:center;">
            Upon full payment, your booking will be fully confirmed and we will reach out to discuss your preferred itinerary.
        </p>
    </td></tr>
    <tr><td style="background:#1a3a4a;padding:24px 40px;text-align:center;">
        <p style="margin:0;color:#c17f59;font-family:Georgia,serif;font-size:12px;letter-spacing:1px;">WANDERING YACHT</p>
        <p style="margin:6px 0 0;color:#8a9a9a;font-family:Georgia,serif;font-size:11px;">Montenegro • Croatia • Albania • Greece</p>
        <p style="margin:8px 0 0;color:#8a9a9a;font-family:Georgia,serif;font-size:11px;">info@wanderingyacht.com</p>
    </td></tr>
</table></td></tr></table></body></html>"""

        msg = MIMEMultipart('related')
        msg['Subject'] = subject
        msg['From'] = f'WANDERING YACHT <{SMTP_EMAIL}>'
        msg['To'] = to_email
        html_part = MIMEText(html, 'html')
        msg.attach(html_part)
        
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.send_message(msg)
        
        logger.info(f"Balance request email sent to {to_email} for booking {booking['id'][:8]}")
        return True
    except Exception as e:
        logger.error(f"Failed to send balance request email: {str(e)}")
        return False


def send_full_payment_confirmation(to_email: str, customer_name: str, booking: dict):
    """Send confirmation email after full balance is paid, asking about itinerary."""
    try:
        subject = f"Full Payment Confirmed — {booking['experience_title']} | WANDERING YACHT"

        html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f3f0;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3f0;">
<tr><td align="center" style="padding:20px 10px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <tr><td style="background:#1a3a4a;padding:30px 40px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:24px;letter-spacing:3px;">WANDERING</h1>
        <h1 style="margin:0;color:#fff;font-size:24px;letter-spacing:3px;">YACHT</h1>
        <p style="margin:10px 0 0;color:#c17f59;font-size:13px;letter-spacing:2px;">BOOKING FULLY CONFIRMED</p>
    </td></tr>
    <tr><td style="padding:30px 40px;">
        <p style="margin:0;color:#1a3a4a;font-size:16px;">Dear {customer_name},</p>
        <p style="margin:12px 0;color:#5a6a6a;font-size:14px;line-height:24px;">
            Wonderful news! Your full payment for <strong>{booking['experience_title']}</strong> has been received. 
            Your booking is now <strong>fully confirmed</strong>.
        </p>
    </td></tr>
    <tr><td style="padding:0 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#e8f5e9;border-radius:12px;border:2px solid #4caf50;">
            <tr><td style="padding:20px;text-align:center;">
                <p style="margin:0;color:#2e7d32;font-size:20px;font-weight:bold;">✅ FULLY PAID</p>
                <p style="margin:8px 0 0;color:#2e7d32;font-size:28px;font-weight:bold;">€{booking['total_amount']:.2f}</p>
            </td></tr>
        </table>
    </td></tr>
    <tr><td style="padding:24px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7;border-radius:12px;border:1px solid #ebe8e3;">
            <tr><td style="padding:20px;">
                <table width="100%">
                    <tr><td style="padding:4px 0;color:#7a8a8a;font-size:13px;">📍 Location</td>
                        <td style="padding:4px 0;color:#1a3a4a;font-size:13px;text-align:right;">{booking['experience_location']}</td></tr>
                    <tr><td style="padding:4px 0;color:#7a8a8a;font-size:13px;">📅 Date</td>
                        <td style="padding:4px 0;color:#1a3a4a;font-size:13px;text-align:right;">{booking['experience_date']}</td></tr>
                    <tr><td style="padding:4px 0;color:#7a8a8a;font-size:13px;">🎫 Booking ID</td>
                        <td style="padding:4px 0;color:#1a3a4a;font-size:13px;text-align:right;">{booking['id'][:8].upper()}</td></tr>
                </table>
            </td></tr>
        </table>
    </td></tr>
    <tr><td style="padding:0 40px 10px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e1;border-radius:12px;border:2px solid #f0c14b;">
            <tr><td style="padding:20px;">
                <p style="margin:0;color:#c17f59;font-size:15px;font-weight:bold;text-align:center;">🗺 CREATE YOUR ITINERARY</p>
                <p style="margin:10px 0 0;color:#5a6a6a;font-size:13px;line-height:22px;text-align:center;">
                    Now that your booking is confirmed, we'd love to help you plan the perfect experience. 
                    What itinerary would you like to create? Reply to this email or contact us with your preferences:
                </p>
                <ul style="color:#5a6a6a;font-size:13px;line-height:26px;">
                    <li>Preferred departure time</li>
                    <li>Desired route or stops</li>
                    <li>Special dietary requirements</li>
                    <li>Any celebrations or special occasions</li>
                    <li>Additional services (chef, DJ, photographer, etc.)</li>
                </ul>
            </td></tr>
        </table>
    </td></tr>
    <tr><td style="padding:16px 40px;text-align:center;">
        <a href="mailto:info@wanderingyacht.com?subject=Itinerary%20for%20Booking%20{booking['id'][:8].upper()}" 
           style="display:inline-block;background:#1a3a4a;color:#fff;font-size:15px;font-weight:bold;text-decoration:none;padding:14px 40px;border-radius:30px;letter-spacing:1px;">
            SHARE YOUR ITINERARY PREFERENCES
        </a>
    </td></tr>
    <tr><td style="background:#1a3a4a;padding:24px 40px;text-align:center;">
        <p style="margin:0;color:#c17f59;font-size:12px;letter-spacing:1px;">WANDERING YACHT</p>
        <p style="margin:6px 0 0;color:#8a9a9a;font-size:11px;">Montenegro • Croatia • Albania • Greece</p>
        <p style="margin:8px 0 0;color:#8a9a9a;font-size:11px;">info@wanderingyacht.com</p>
    </td></tr>
</table></td></tr></table></body></html>"""

        msg = MIMEMultipart('related')
        msg['Subject'] = subject
        msg['From'] = f'WANDERING YACHT <{SMTP_EMAIL}>'
        msg['To'] = to_email
        html_part = MIMEText(html, 'html')
        msg.attach(html_part)
        
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.send_message(msg)
        
        logger.info(f"Full payment confirmation email sent to {to_email} for booking {booking['id'][:8]}")
        return True
    except Exception as e:
        logger.error(f"Failed to send full payment confirmation: {str(e)}")
        return False
