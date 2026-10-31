import unittest
from no_plaintext import allowed


class NoPlaintextTests(unittest.TestCase):
    def test_clear_text_and_file_and_custom_events_are_denied(self):
        for kind in ("m.room.message", "m.sticker", "custom.message"):
            with self.subTest(kind=kind):
                self.assertFalse(allowed({"type": kind, "content": {"body": "secret", "url": "mxc://test/file"}}))

    def test_envelope_requires_algorithm_and_fields(self):
        envelope = {"algorithm": "m.megolm.v1.aes-sha2", "ciphertext": "opaque", "sender_key": "key", "session_id": "session"}
        self.assertTrue(allowed({"type": "m.room.encrypted", "content": envelope}))
        for key in envelope:
            broken = {name: value for name, value in envelope.items() if name != key}
            self.assertFalse(allowed({"type": "m.room.encrypted", "content": broken}))
        self.assertFalse(allowed({"type": "m.room.encrypted", "content": {**envelope, "body": "secret"}}))

    def test_membership_and_normal_room_setup_still_allowed(self):
        self.assertTrue(allowed({"type": "m.room.member", "state_key": "@agent.a:test", "content": {"membership": "join"}}))
        self.assertTrue(allowed({"type": "m.room.create", "state_key": "", "content": {}}))

    def test_state_key_does_not_bypass_message_filter(self):
        self.assertFalse(allowed({"type": "m.room.message", "state_key": "", "content": {"body": "secret"}}))
        self.assertFalse(allowed({"type": "custom.state", "state_key": "", "content": {}}))

    def test_encryption_downgrade_is_denied(self):
        self.assertTrue(allowed({"type": "m.room.encryption", "state_key": "", "content": {"algorithm": "m.megolm.v1.aes-sha2"}}))
        self.assertFalse(allowed({"type": "m.room.encryption", "state_key": "", "content": {}}))
        self.assertFalse(allowed({"type": "m.room.encryption", "state_key": "", "content": {"algorithm": "plain"}}))

    def test_redaction_has_no_plaintext_reason(self):
        self.assertTrue(allowed({"type": "m.room.redaction", "content": {}}))
        self.assertFalse(allowed({"type": "m.room.redaction", "content": {"reason": "secret"}}))


if __name__ == "__main__":
    unittest.main()
