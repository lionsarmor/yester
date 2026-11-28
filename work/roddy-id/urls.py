from django.conf import settings
from django.urls import include, path
from django.shortcuts import render
from people.views import home, buddies

urlpatterns = [path("", home, name="home"), path("buddies/",buddies)]
if not settings.EMAIL_HOST:
    def mail_pending(request, **kwargs):
        return render(request,"mail_pending.html",status=503)
    urlpatterns += [path("password/reset/",mail_pending), path("email/",mail_pending)]
urlpatterns += [path("",include("allauth.urls")), path("",include("allauth.idp.urls"))]
