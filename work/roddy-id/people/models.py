import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.functions import Lower

class Person(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        constraints = [models.UniqueConstraint(Lower("username"), name="unique_handle_ci"),
                       models.UniqueConstraint(Lower("email"), name="unique_email_ci")]

class Invitation(models.Model):
    sender = models.ForeignKey(Person, on_delete=models.CASCADE, related_name="sent_invites")
    recipient = models.ForeignKey(Person, on_delete=models.CASCADE, related_name="received_invites")
    accepted = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=~models.Q(sender=models.F("recipient")), name="different_people"),
            models.UniqueConstraint(models.functions.Least("sender","recipient"),
                                    models.functions.Greatest("sender","recipient"), name="one_relationship"),
        ]

class ProjectLink(models.Model):
    section = models.CharField(max_length=60)
    label = models.CharField(max_length=100)
    url = models.URLField(max_length=1000, unique=True)

    class Meta:
        ordering = ("section", "label")
