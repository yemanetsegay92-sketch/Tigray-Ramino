import importlib.util
import io
import json
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('ramino_telegram', Path(__file__).parents[1] / 'api/telegram.py')
bot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bot)

class TelegramTests(unittest.TestCase):
    def message(self, text, kind='private'):
        return {'message': {'chat': {'id': 123, 'type': kind}, 'text': text}}

    def test_private_launch_and_all_opening_methods(self):
        with patch.object(bot, 'send_message') as send:
            bot.handle_update(self.message('/start'))
        _, text, keyboard = send.call_args.args
        self.assertIn('41+', text)
        self.assertIn('three valid combinations', text)
        self.assertIn('four-image', text)
        self.assertEqual(keyboard['inline_keyboard'][0][0]['web_app']['url'], bot.GAME_URL)

    def test_group_launch_uses_regular_url(self):
        with patch.object(bot, 'send_message') as send:
            bot.handle_update(self.message('/start@Ramino41_bot', 'supergroup'))
        button = send.call_args.args[2]['inline_keyboard'][0][0]
        self.assertEqual(button['url'], bot.GAME_URL)
        self.assertNotIn('web_app', button)

    def test_help_and_rules_explain_elimination_and_jokers(self):
        for command in ['/help', '/rules']:
            with patch.object(bot, 'send_message') as send:
                bot.handle_update(self.message(command))
            text = send.call_args.args[1]
            self.assertIn('Win that turn or be eliminated', text)
            self.assertIn('Only normally opened players', text)
            self.assertIn('additions to other players', text)

    def test_unrelated_commands_do_not_trigger_start(self):
        with patch.object(bot, 'send_message') as send:
            for command in ['/starter', '/start@AnotherBot', '', None]:
                bot.handle_update(self.message(command))
            bot.handle_update({})
        send.assert_not_called()

    def handler(self, update, headers=None):
        h = object.__new__(bot.handler)
        body = json.dumps(update).encode()
        h.headers = {'Content-Length': str(len(body)), **(headers or {})}
        h.rfile = io.BytesIO(body)
        h.wfile = io.BytesIO()
        h.send_response = lambda status: setattr(h, 'status', status)
        h.send_header = lambda *args: None
        h.end_headers = lambda: None
        return h

    def test_webhook_secret_rejects_wrong_secret(self):
        h = self.handler(self.message('/start'))
        with patch.object(bot, 'WEBHOOK_SECRET', 'test-secret'), patch.object(bot, 'send_message') as send:
            h.do_POST()
        self.assertEqual(h.status, 403)
        send.assert_not_called()

    def test_successful_webhook_acknowledges(self):
        h = self.handler(self.message('/start'))
        with patch.object(bot, 'WEBHOOK_SECRET', None), patch.object(bot, 'send_message'):
            h.do_POST()
        self.assertEqual(h.status, 200)
        self.assertEqual(json.loads(h.wfile.getvalue()), {'ok': True})

    def test_failed_delivery_can_retry_and_does_not_log_token(self):
        h = self.handler(self.message('/start'))
        with patch.object(bot, 'WEBHOOK_SECRET', None), patch.object(bot, 'send_message', side_effect=RuntimeError('secret-token-url')), patch('builtins.print') as log:
            h.do_POST()
        self.assertEqual(h.status, 503)
        self.assertNotIn('secret-token-url', str(log.call_args))

    def test_health_reports_missing_configuration(self):
        h = self.handler({})
        with patch.object(bot, 'BOT_TOKEN', None):
            h.do_GET()
        self.assertEqual(h.status, 503)

if __name__ == '__main__':
    unittest.main()
