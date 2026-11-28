from django.urls import path
from people import project_index as desk
urlpatterns = [path("",desk.index),path("auth/login",desk.enter),path("auth/callback",desk.callback),
               path("remove/<int:pk>",desk.remove),path("signout",desk.leave)]
