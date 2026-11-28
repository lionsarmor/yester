from django.contrib import messages
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from .models import Person, Invitation

def home(request):
    rows = []
    if request.user.is_authenticated:
        rows = Invitation.objects.filter(Q(sender=request.user)|Q(recipient=request.user)).select_related("sender","recipient")
    from .project_index import founder_id
    return render(request,"home.html",{"rows":rows,"is_founder":request.user.is_authenticated and str(request.user.pk)==founder_id()})

@login_required
@require_POST
def buddies(request):
    user = request.user
    action = request.POST.get("action")
    if action == "invite":
        peer = Person.objects.filter(username__iexact=request.POST.get("handle","").strip(),is_active=True).first()
        if not peer or user == peer:
            messages.error(request,"Choose another registered handle.")
        else:
            try:
                with transaction.atomic():
                    Invitation.objects.create(sender=user,recipient=peer)
                messages.success(request,"Invitation sent.")
            except IntegrityError:
                messages.info(request,"You already have an invitation or friendship with this person.")
    elif action in ("accept","remove"):
        key = request.POST.get("invite","")
        if key.isascii() and key.isdigit() and len(key) <= 18:
            if action == "accept":
                Invitation.objects.filter(pk=key,recipient=user,accepted=False).update(accepted=True)
            else:
                Invitation.objects.filter(Q(sender=user)|Q(recipient=user),pk=key).delete()
    return redirect("home")
