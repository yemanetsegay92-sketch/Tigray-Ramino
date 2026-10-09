import json
import os
import urllib.request
from http.server import BaseHTTPRequestHandler


BOT_TOKEN = os.environ.get("BOT_TOKEN")
GAME_URL = os.environ.get(
    "GAME_URL",
    "https://tigray-ramino.vercel.app"
)
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET")
BOT_USERNAME = os.environ.get("BOT_USERNAME", "Ramino41_bot")


def telegram_api(method, data):
    if not BOT_TOKEN:
        raise RuntimeError("Telegram bot is not configured")
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/{method}"

    body = json.dumps(data).encode("utf-8")

    request = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json"
        },
        method="POST"
    )

    with urllib.request.urlopen(request, timeout=8) as response:
        body = response.read()
        if not json.loads(body).get("ok"):
            raise RuntimeError("Telegram rejected the request")
        return body


def send_message(chat_id, text, keyboard=None):
    data = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown"
    }

    if keyboard:
        data["reply_markup"] = keyboard

    return telegram_api("sendMessage", data)


def handle_update(update):
    message = update.get("message")

    if not message:
        return

    chat = message.get("chat")
    if not chat:
        return

    chat_id = chat.get("id")

    text = (message.get("text") or "").strip()
    command = text.split(maxsplit=1)[0] if text else ""
    parts = command.split("@", 1)
    if len(parts) == 2 and parts[1].lower() != BOT_USERNAME.lower():
        return
    command = parts[0].lower()

    if command == "/start":

        # Telegram permits web_app inline buttons only in private chats.
        # In groups use an ordinary HTTPS button instead.
        button = {"text": "🃏 Play Tigray Ramino"}
        if chat.get("type") == "private":
            button["web_app"] = {"url": GAME_URL}
        else:
            button["url"] = GAME_URL
        keyboard = {
            "inline_keyboard": [
                [
                    button
                ]
            ]
        }

        send_message(
            chat_id,
            "🔥 *Tigray Ramino*\n\n"
            "Tap the button below to open the game.\n\n"
            "🎯 Open in one turn with 41+ points, three valid combinations, "
            "or a valid four-image combination.\n"
            "Draw or take, play, then discard—even when winning. Good luck!",
            keyboard
        )

    elif command in ("/help", "/rules"):

        send_message(
            chat_id,
            "🃏 *Tigray Ramino rules*\n\n"
            "• First player: 14 cards, discard first. Others: 13 cards.\n"
            "• Each turn: draw or take → play → discard, including the winning turn.\n\n"
            "*Opening — complete one condition in one turn:*\n"
            "• 41+ points across valid combinations.\n"
            "• Three valid combinations, even below 41.\n"
            "• Same-suit J–Q–K–A, or a valid four-card group of J, Q, K or A.\n"
            "All three give equal rights. An unfinished opening attempt eliminates you.\n\n"
            "*Ace points:* 1 in low-Ace sequences (A–2–3), 11 in high-Ace sequences and groups. "
            "Three Aces score 33.\n\n"
            "*Win value:* Monte and a final Joker discard are double, even together. Maximum: double.\n\n"
            "*Joker replacement:* Only normally opened players may replace a table Joker "
            "with its exact represented card. Win that turn with a final discard, or lose.\n\n"
            "*Monte Win:* Five identical pairs + one valid three-card combination + final discard. "
            "A Joker may pair with an ordinary card. You may activate Monte after taking the discard. "
            "Monte grants no normal opening rights and forbids table Joker replacement. "
            "Win that turn or be eliminated.\n\n"
            "*Elimination:* Your openings and additions to other players’ combinations are removed. "
            "Any combination that becomes invalid is cleared too.\n\n"
            "Tap cards to select; drag sideways to reorder, to the table to play, "
            "or to the discard pile to discard."

        )


class handler(BaseHTTPRequestHandler):

    def do_GET(self):
        self.send_response(200 if BOT_TOKEN else 503)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(
            b"Tigray Ramino Telegram webhook is running."
            if BOT_TOKEN else b"Telegram bot is not configured."
        )

    def do_POST(self):

        if WEBHOOK_SECRET:
            received_secret = self.headers.get(
                "X-Telegram-Bot-Api-Secret-Token"
            )

            if received_secret != WEBHOOK_SECRET:
                self.send_response(403)
                self.end_headers()
                return

        try:
            content_length = int(
                self.headers.get("Content-Length", "0")
            )

            body = self.rfile.read(content_length)

            update = json.loads(body.decode("utf-8"))

            handle_update(update)

            self.send_response(200)
            self.send_header(
                "Content-Type",
                "application/json"
            )
            self.end_headers()

            self.wfile.write(
                b'{"ok":true}'
            )

        except Exception as error:

            # Exception messages from HTTP clients can contain the bot-token URL.
            print("Webhook delivery failed:", type(error).__name__)

            # Telegram must be able to retry a failed delivery.
            self.send_response(503)
            self.send_header(
                "Content-Type",
                "application/json"
            )
            self.end_headers()

            self.wfile.write(
                b'{"ok":false}'
            )
