"""Provision the founder once from a precomputed Django password hash on stdin."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "settings")
import django
django.setup()

from django.contrib.auth.hashers import identify_hasher
from django.db import transaction
from people.models import Person
from allauth.account.models import EmailAddress

founder_email = os.environ["RODDY_FOUNDER_EMAIL"].strip().lower()
with transaction.atomic():
    encoded = sys.stdin.readline().strip()
    if identify_hasher(encoded).algorithm != "pbkdf2_sha256":
        raise ValueError("Expected a Django PBKDF2 hash")
    founder = Person.objects.filter(username__iexact="RODDY").first()
    if founder is None:
        founder = Person.objects.create(username="RODDY",email=founder_email,password=encoded)
        EmailAddress.objects.create(user=founder,email=founder.email,primary=True,verified=False)
    elif (founder.email, founder.password) != (founder_email, encoded):
        raise ValueError("Existing founder differs; refusing to replace the account")
print("Founder ready")
from django.conf import settings
(settings.STATE / "founder.id").write_text(str(founder.pk))
