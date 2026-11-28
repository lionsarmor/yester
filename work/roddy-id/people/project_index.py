import time
from urllib.parse import urlsplit

from authlib.integrations.django_client import OAuth
from authlib.integrations.base_client.errors import OAuthError
from django import forms
from django.conf import settings
from django.http import HttpResponseForbidden
from django.shortcuts import redirect, render
from django.views.decorators.http import require_POST
from django.utils.cache import patch_cache_control
from .models import ProjectLink

HOST = "index.roddy.world"
ISSUER = "https://accounts.roddy.world"
oauth = OAuth()
oauth.register("index",client_id="founder-index",server_metadata_url=ISSUER+"/.well-known/openid-configuration",
              client_kwargs={"scope":"openid","code_challenge_method":"S256","token_endpoint_auth_method":"none"})

def founder_id():
    path = settings.STATE / "founder.id"
    return path.read_text().strip() if path.is_file() else ""

class IndexHost:
    def __init__(self,get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.get_host() != HOST:
            return self.get_response(request)
        request.urlconf = "index_urls"
        response = self.get_response(request)
        patch_cache_control(response, private=True, no_store=True)
        response["X-Robots-Tag"] = "noindex, nofollow"
        return response

def authorized(request):
    return (request.session.get("index_until",0) > time.time()
            and bool(request.session.get("index_subject"))
            and request.session["index_subject"] == founder_id())

def enter(request):
    return oauth.index.authorize_redirect(request, "https://"+HOST+"/auth/callback")

def callback(request):
    try:
        token = oauth.index.authorize_access_token(request)
        sub = token["userinfo"]["sub"]
    except (OAuthError, KeyError, ValueError):
        return render(request,"index_denied.html",status=403)
    if sub != founder_id():
        request.session.flush()
        return render(request,"index_denied.html",status=403)
    request.session.cycle_key()
    request.session["index_subject"] = sub
    request.session["index_until"] = time.time()+min(token["expires_in"],3600)
    return redirect("/")

class LinkForm(forms.ModelForm):
    class Meta:
        model = ProjectLink
        fields = ["section","label","url"]

    def clean_url(self):
        url = self.cleaned_data["url"]
        u = urlsplit(url)
        if u.scheme != "https" or u.username or u.password:
            raise forms.ValidationError("Enter an HTTPS project address without credentials.")
        return url

def index(request):
    if not authorized(request):
        return redirect("/auth/login")
    form = LinkForm(request.POST or None)
    if request.method=="POST" and form.is_valid():
        form.save()
        return redirect("/")
    return render(request,"projects.html",{"links":ProjectLink.objects.all(),"form":form})

@require_POST
def remove(request,pk):
    if not authorized(request): return HttpResponseForbidden()
    ProjectLink.objects.filter(pk=pk).delete()
    return redirect("/")

@require_POST
def leave(request):
    request.session.flush()
    return redirect(ISSUER+"/")
