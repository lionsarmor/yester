from django.http import HttpResponse
from django.utils.cache import patch_vary_headers

class BrowserClientCors:
    """Expose bearer-token endpoints to the registered Orbit web client."""
    origins = {"https://orbit.143-244-168-180.sslip.io","https://console.143-244-168-180.sslip.io"}
    paths = {"/identity/o/api/token", "/identity/o/api/userinfo"}
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path not in self.paths or request.headers.get("Origin") not in self.origins:
            return self.get_response(request)
        response = HttpResponse(status=204) if request.method == "OPTIONS" else self.get_response(request)
        response["Access-Control-Allow-Origin"] = request.headers["Origin"]
        response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
        patch_vary_headers(response, ["Origin"])
        return response
