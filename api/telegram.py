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


def telegram_api(method, data):
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
        return response.read()


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

    text = message.get("text", "").strip()

    if text.startswith("/start"):

        keyboard = {
            "inline_keyboard": [
                [
                    {
                        "text": "🃏 Play Tigray Ramino",
                        "web_app": {
                            "url": GAME_URL
                        }
                    }
                ]
            ]
        }

        send_message(
            chat_id,
            "🔥 *Tigray Ramino*\n\n"
            "Tap the button below to open the game.\n\n"
            "🎯 Open with 41 points. Good luck!",
            keyboard
        )

    elif text.startswith("/help"):

        send_message(
            chat_id,
            "🎮 *How to play:*\n"
            "• Tap cards to select them\n"
            "• Drag left/right to reorder your hand\n"
            "• Drag up to the table to open a combo\n"
            "• Drag to the discard pile to discard\n\n"
            "📖 Full rules are inside the game."
        )


class handler(BaseHTTPRequestHandler):

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(b"Tigray Ramino Telegram webhook is running.")

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

            print("Webhook error:", error)

            # Return 200 so Telegram does not repeatedly
            # retry an update because of our internal error.
            self.send_response(200)
            self.send_header(
                "Content-Type",
                "application/json"
            )
            self.end_headers()

            self.wfile.write(
                b'{"ok":false}'
            )
