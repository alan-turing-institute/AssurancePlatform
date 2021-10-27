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
    #path('contexts/', views.context_list),
    #path('contexts/<int:pk>/', views.context_detail),
    #path('descriptions/', views.description_list),
    #path('descriptions/<int:pk>/', views.description_detail),
    #path('propertyclaims/', views.property_claim_list),
    #path('propertyclaims/<int:pk>/', views.property_claim_detail),
    #path('arguments/', views.argument_list),
    #path('arguments/<int:pk>/', views.argument_detail),
    #path('evidentialclaims/', views.evidential_claim_list),
    #path('evidentialclaims/<int:pk>/', views.evidential_claim_detail),
    #path('evidence/', views.evidence_list),
    #path('evidence/<int:pk>/', views.evidence_detail),
    #path('api-auth/', include('rest_framework.urls', namespace='rest_framework'))
]
