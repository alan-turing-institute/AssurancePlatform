from django.urls import path

from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('case/<int:case_id>/', views.get_case, name='get_case'),
    path('case/<str:name>/<str:description>/', views.make_case, name='make_case')
]
