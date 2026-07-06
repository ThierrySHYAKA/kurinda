"""
Kurinda - quick SMS smoke test.

Sends ONE Kinyarwanda test alert to the sandbox simulator number, to confirm
the Africa's Talking credentials work BEFORE we wire SMS into the API.

Run from the backend/ folder:  python test_sms.py
Then check your sandbox simulator / Outbox for the message.
"""
import os
from dotenv import load_dotenv
import africastalking

load_dotenv()  # reads backend/.env

USERNAME = os.getenv("AT_USERNAME")
API_KEY = os.getenv("AT_API_KEY")
TEST_NUMBER = os.getenv("AT_TEST_NUMBER")

if not all([USERNAME, API_KEY, TEST_NUMBER]):
    raise SystemExit(
        "Missing env vars. Ensure backend/.env has AT_USERNAME, AT_API_KEY, "
        "AT_TEST_NUMBER."
    )

africastalking.initialize(USERNAME, API_KEY)
sms = africastalking.SMS

# The Kinyarwanda alert template from the Kurinda user journey.
message = (
    "MUTUZO: Umudugudu wa Nyange uri mu kaga ko kwangirika k'imirire mu "
    "mezi 3 ari imbere. Sura imiryango ifite abana bari munsi y'imyaka 2. "
    "Subiza 1 wemeje."
)

print(f"Sending test SMS to {TEST_NUMBER} ...")
try:
    resp = sms.send(message, [TEST_NUMBER])
    print("Response:")
    print(resp)
    print("\nOK - check your sandbox simulator / Outbox for the message.")
except Exception as e:
    print(f"FAILED: {type(e).__name__}: {e}")
