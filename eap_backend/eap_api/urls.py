from django.urls import path, include
from . import views


urlpatterns = [
    path("home", views.AssuranceView.as_view(), name="home"),
    path("home_goals", views.GoalsView.as_view(), name="home"),
    path("cases/", views.case_list, name="case_list"),
    path("cases/<int:pk>/", views.case_detail, name="case_detail"),
    path("goals/", views.goal_list, name="goal_list"),
    path("goals/<int:pk>/", views.goal_detail, name="goal_detail"),
    path("contexts/", views.context_list, name="context_list"),
    path("contexts/<int:pk>/", views.context_detail, name="context_detail"),
    path("descriptions/", views.description_list, name="description_list"),
    path("descriptions/<int:pk>/", views.description_detail, name="description_detail"),
    path("propertyclaims/", views.property_claim_list, name="property_claim_list"),
    path(
        "propertyclaims/<int:pk>/",
        views.property_claim_detail,
        name="property_claim_detail",
    ),
    path(
        "evidentialclaims/", views.evidential_claim_list, name="evidential_claim_list"
    ),
    path(
        "evidentialclaims/<int:pk>/",
        views.evidential_claim_detail,
        name="evidential_claim_detail",
    ),
    path("evidence/", views.evidence_list, name="evidence_list"),
    path("evidence/<int:pk>/", views.evidence_detail, name="evidence_detail"),
    path(
        "parents/<str:item_type>/<int:pk>",
        views.parents,
        name="parents",
    ),
    path("api-auth/", include("rest_framework.urls", namespace="rest_framework")),
]
