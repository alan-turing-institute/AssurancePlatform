from django.urls import include, path

# from .views import CaseStudyViewSet  # Import your viewset
from . import views

# router = DefaultRouter()
# router.register(r'case-studies', CaseStudyViewSet, basename='case-study')

urlpatterns = [
    # path('', include(router.urls)),  # Add this line to include viewset routes
    path("auth/", include("rest_auth.urls")),
    path("auth/register/", include("rest_auth.registration.urls")),
    path("user/", views.self_detail, name="self_detail"),
    path("users/", views.user_list, name="user_list"),
    path("users/<int:pk>/", views.user_detail, name="user_detail"),
    path(
        "users/<int:pk>/change-password",
        views.change_user_password,
        name="change_user_password",
    ),
    path("groups/", views.group_list, name="group_list"),
    path("groups/<int:pk>/", views.group_detail, name="group_detail"),
    path("cases/", views.case_list, name="case_list"),
    path("cases/<int:pk>/", views.case_detail, name="case_detail"),
    path("cases/<int:pk>/image", views.case_image, name="case_image"),
    path("cases/<int:pk>/sandbox", views.case_sandbox, name="case_sandbox"),
    path("cases/<int:pk>/sharedwith", views.share_case_with, name="share_case_with"),
    path(
        "cases/<int:pk>/update-ids",
        views.case_update_identifiers,
        name="update_identifiers",
    ),
    path("goals/", views.goal_list, name="goal_list"),
    path("goals/<int:pk>/", views.goal_detail, name="goal_detail"),
    path("contexts/", views.context_list, name="context_list"),
    path("contexts/<int:pk>/", views.context_detail, name="context_detail"),
    path("contexts/<int:pk>/detach", views.detach_context, name="detach_context"),
    path("contexts/<int:pk>/attach", views.attach_context, name="attach_context"),
    path(
        "propertyclaims/",
        views.property_claim_list,
        name="property_claim_list",
    ),
    path(
        "propertyclaims/<int:pk>/",
        views.property_claim_detail,
        name="property_claim_detail",
    ),
    path(
        "propertyclaims/<int:pk>/detach",
        views.detach_property_claim,
        name="detach_property_claim",
    ),
    path(
        "propertyclaims/<int:pk>/attach",
        views.attach_property_claim,
        name="attach_property_claim",
    ),
    path(
        "<str:element_name>/<int:element_id>/comments/",
        views.comment_list,
        name="comment_list",
    ),
    path("comments/<int:pk>/", views.comment_detail, name="comment_detail"),
    path(
        "comments/<int:comment_id>/reply/",
        views.reply_to_comment,
        name="reply_to_comment",
    ),
    path(
        "comments/<int:pk>/", views.CommentEdit.as_view(), name="comment_edit"
    ),  # Use the view class
    path("evidence/", views.evidence_list, name="evidence_list"),
    path("evidence/<int:pk>/", views.evidence_detail, name="evidence_detail"),
    path("evidence/<int:pk>/detach", views.detach_evidence, name="detach_evidence"),
    path("evidence/<int:pk>/attach", views.attach_evidence, name="attach_evidence"),
    path(
        "parents/<str:item_type>/<int:pk>",
        views.parents,
        name="parents",
    ),
    path("api-auth/", include("rest_framework.urls", namespace="rest_framework")),
    path("strategies/", views.strategies_list, name="strategies_list"),
    path("strategies/<int:pk>/", views.strategy_detail, name="strategy_detail"),
    path("strategies/<int:pk>/detach", views.detach_strategy, name="detach_strategy"),
    path("strategies/<int:pk>/attach", views.attach_strategy, name="attach_strategy"),
    path("auth/github/", views.GithubSocialAuthView.as_view()),
    path(
        "auth/<str:backend>/register-by-token/",
        views.register_by_access_token,
        name="register_by_access_token",
    ),
    path(
        "users/<int:pk>/github_repositories/",
        views.github_repository_list,
        name="github_repository_list",
    ),
    path(
        "github_repositories/",
        views.github_repository_list,
        name="github_repository_list",
    ),
    path("case-studies/", views.case_study_list, name="case_study_list"),
    path("case-studies/<int:pk>/", views.case_study_detail, name="case_study_detail"),
    path(
        "case-studies/<int:pk>/image/",
        views.case_study_feature_image,
        name="case_study_feature_image",
    ),
    path(
        "published-assurance-cases/",
        views.published_assurance_case_list,
        name="published_assurance_case_list",
    ),
    path(
        "public/case-studies/",
        views.public_case_study_list,
        name="public_case_study_list",
    ),
    path(
        "public/case-studies/<int:pk>/",
        views.public_case_study_detail,
        name="public_case_study_detail",
    ),
    path(
        "public/assurance-case/<uuid:id>/",
        views.published_assurance_case_detail,
        name="published_assurance_case_detail",
    ),
]
