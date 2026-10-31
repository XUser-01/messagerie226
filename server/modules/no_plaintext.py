"""Politique locale du prototype : seuls les événements de conversation chiffrés.

Les événements d'état nécessaires à Matrix restent des métadonnées visibles.
La forme d'une enveloppe ne prouve pas son contenu cryptographique.
"""
from collections.abc import Mapping

STATE_TYPES = frozenset({
    "m.room.create", "m.room.member", "m.room.power_levels", "m.room.join_rules",
    "m.room.history_visibility", "m.room.guest_access", "m.room.name",
    "m.room.topic", "m.room.avatar", "m.room.canonical_alias", "m.room.server_acl",
    "m.room.tombstone",
})


def allowed(event):
    """Décision sans effet de bord, à partir du dictionnaire d'un événement."""
    kind = event.get("type")
    content = event.get("content", {})
    if not isinstance(content, Mapping):
        return False
    if "state_key" in event:
        if kind == "m.room.encryption":
            return event["state_key"] == "" and content.get("algorithm") == "m.megolm.v1.aes-sha2"
        return kind in STATE_TYPES
    if kind == "m.room.redaction":
        # Pas de motif libre, qui serait du texte transmis en clair.
        return "reason" not in content
    if kind != "m.room.encrypted":
        return False
    return (
        content.get("algorithm") == "m.megolm.v1.aes-sha2"
        and all(isinstance(content.get(key), str) and content[key]
                for key in ("ciphertext", "session_id", "sender_key"))
        and not any(key in content for key in ("body", "formatted_body", "url", "file"))
    )


class NoPlaintext:
    def __init__(self, config, api):
        # Import local : les tests de politique n'ont pas besoin d'installer Synapse.
        from synapse.module_api import NOT_SPAM
        from synapse.module_api.errors import Codes
        self.accept = NOT_SPAM
        self.reject = Codes.FORBIDDEN
        api.register_spam_checker_callbacks(check_event_for_spam=self.check_event_for_spam)

    async def check_event_for_spam(self, event):
        return self.accept if allowed(event.get_dict()) else self.reject
