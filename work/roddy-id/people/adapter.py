import re
from django.core.exceptions import ValidationError
from allauth.account.adapter import DefaultAccountAdapter

class HandleAdapter(DefaultAccountAdapter):
    def clean_username(self, username, shallow=False):
        name = super().clean_username(username, shallow)
        if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_-]{1,23}", name):
            raise ValidationError("Use 2–24 letters, numbers, hyphens or underscores.")
        if name.casefold() == "roddy":
            raise ValidationError("This handle is reserved.")
        return name

    def clean_email(self, email):
        email = super().clean_email(email).strip().lower()
        return email

from allauth.idp.oidc.adapter import DefaultOIDCAdapter
from django.db.models import Q
from .models import Invitation

class BuddyClaims(DefaultOIDCAdapter):
    def get_claims(self, purpose, user, client, scopes, **kwargs):
        claims = super().get_claims(purpose, user, client, scopes, **kwargs)
        if purpose == "userinfo" and "buddies" in scopes:
            pairs = Invitation.objects.filter(Q(sender=user) | Q(recipient=user),
                                              accepted=True).select_related("sender", "recipient")
            peers = [row.recipient if row.sender_id == user.pk else row.sender for row in pairs]
            claims["buddies"] = [{"sub":str(peer.pk),"handle":peer.username}
                                 for peer in peers if peer.is_active]
        return claims
