from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render
from .models import AssuranceCase

def index(request):
    return HttpResponse("Hello, world. You're at the api index.")


def get_case(request, case_id):
    case = get_object_or_404(AssuranceCase, pk=case_id)
    return HttpResponse(case)

def make_case(request, name, description):
    case = AssuranceCase(name=name, description=description)
    case.save()
    return HttpResponse(case)
