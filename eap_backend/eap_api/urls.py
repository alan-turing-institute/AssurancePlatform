from django.urls import include, path

from . import views

urlpatterns = [
    path("auth/", include("rest_auth.urls")),
    path("auth/register/", include("rest_auth.registration.urls")),
    path("users/", views.user_list, name="user_list"),
    path("users/<int:pk>/", views.user_detail, name="user_detail"),
    path("groups/", views.group_list, name="group_list"),
    path("groups/<int:pk>/", views.group_detail, name="group_detail"),
    path("cases/", views.case_list, name="case_list"),
    path("cases/<int:pk>/", views.case_detail, name="case_detail"),
    path("goals/", views.goal_list, name="goal_list"),
    path("goals/<int:pk>/", views.goal_detail, name="goal_detail"),
    path("contexts/", views.context_list, name="context_list"),
    path("contexts/<int:pk>/", views.context_detail, name="context_detail"),
    path("propertyclaims/", views.property_claim_list, name="property_claim_list"),
    path(
        "propertyclaims/<int:pk>/",
        views.property_claim_detail,
        name="property_claim_detail",
    ),
    path("evidence/", views.evidence_list, name="evidence_list"),
    path("evidence/<int:pk>/", views.evidence_detail, name="evidence_detail"),
    path(
        "parents/<str:item_type>/<int:pk>",
        views.parents,
        name="parents",
    ),
    path("api-auth/", include("rest_framework.urls", namespace="rest_framework")),
    path("strategies/", views.strategies_list, name="strategies_list"),
    path("strategies/<int:pk>/", views.strategy_detail, name="strategy_detail"),
]
