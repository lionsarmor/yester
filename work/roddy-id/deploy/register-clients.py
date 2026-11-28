"""Run only on the identity server after the site migrations."""
from allauth.idp.oidc.models import Client

def configure_clients():
    Client.objects.update_or_create(
        id="yestersites",
        defaults={"name":"YesterSites and Retro Page","type":Client.Type.PUBLIC,
                  "scopes":"openid\nprofile","redirect_uris":
                  "https://yestersites-webring.jamesmweeksjr.chatgpt.site/api/roddy/callback","skip_consent":True})
configure_clients()

orbit = "https://orbit.143-244-168-180.sslip.io"
Client.objects.update_or_create(
    id="orbit-web", defaults={"name":"Orbit", "type":Client.Type.PUBLIC,
                             "scopes":"openid\nprofile\nbuddies", "cors_origins":orbit,
                             "redirect_uris":orbit+"/roddy-return.html", "skip_consent":False})

Client.objects.update_or_create(
    id="buddy-web", defaults={"name":"BUDDY messenger", "type":Client.Type.PUBLIC,
                              "scopes":"openid\nprofile\nbuddies",
                              "redirect_uris":"https://buddy.roddy.world/auth/callback", "skip_consent":False})

Client.objects.update_or_create(
    id="founder-index", defaults={"name":"Private RODDY project index", "type":Client.Type.PUBLIC,
                                 "scopes":"openid","redirect_uris":"https://index.roddy.world/auth/callback",
                                 "skip_consent":True})

desk = "https://console.143-244-168-180.sslip.io"
Client.objects.update_or_create(
    id="desk-commander-web", defaults={"name":"Desk Commander", "type":Client.Type.PUBLIC,
                                      "scopes":"openid\nprofile\nbuddies", "cors_origins":desk,
                                      "redirect_uris":desk+"/roddy-return.html","skip_consent":False})
