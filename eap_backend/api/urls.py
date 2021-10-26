from django.urls import path, include
from django.contrib.auth.models import User
from rest_framework import routers
from . import views

# Routers provide an easy way of automatically determining the URL conf.
#router = routers.DefaultRouter()
#router.register(r'cases', views.AssuranceCaseViewSet)
#router.register(r'goals', views.TopLevelNormativeGoalViewSet)


urlpatterns = [
    path('cases/', views.case_list),
    path('cases/<int:pk>/', views.case_detail),
    path('goals/', views.goal_list),
    path('goals/<int:pk>/', views.goal_detail),
    path('api-auth/', include('rest_framework.urls', namespace='rest_framework'))
]
