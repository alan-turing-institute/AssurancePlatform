from django.db import models
from django.utils import timezone
import datetime
from enum import Enum

# Create your models here.

class Shape(Enum):
    """
    Enum class to hold the various shapes for the objects on
    our diagram.
    """
    RECTANGLE = 0
    DIAMOND = 1
    ROUNDED_RECTANGLE = 2
    CYLINDER = 3

class AssuranceCase(models.Model):
    name = models.CharField(max_length=200)
    description = models.CharField(max_length=1000)
    created_date = models.DateTimeField(auto_now_add=True)
    shape = None
    def __str__(self):
        return self.name
    def was_published_recently(self):
        return self.created_date >= timezone.now() - datetime.timedelta(days=1)

class TopLevelNormativeGoal(models.Model):
    name = models.CharField(max_length=200)
    short_description = models.CharField(max_length=1000)
    long_description = models.CharField(max_length=3000)
    keywords = models.CharField(max_length=3000)
    assurance_case = models.ForeignKey(AssuranceCase, on_delete=models.CASCADE)
    shape = Shape.RECTANGLE
    def __str__(self):
        return self.name

class Context(models.Model):
    name = models.CharField(max_length=200)
    short_description = models.CharField(max_length=1000)
    long_description = models.CharField(max_length=3000)
    shape = Shape.DIAMOND
    created_date = models.DateTimeField(auto_now_add=True)
    goal = models.ForeignKey(TopLevelNormativeGoal, on_delete=models.CASCADE)

class SystemDescription(models.Model):
    name = models.CharField(max_length=200)
    short_description = models.CharField(max_length=1000)
    long_description = models.CharField(max_length=3000)
    shape = Shape.DIAMOND
    goal = models.ForeignKey(TopLevelNormativeGoal, on_delete=models.CASCADE)

class PropertyClaim(models.Model):
    name = models.CharField(max_length=200)
    short_description = models.CharField(max_length=1000)
    long_description = models.CharField(max_length=3000)
    shape = Shape.ROUNDED_RECTANGLE
    goal = models.ForeignKey(TopLevelNormativeGoal, on_delete=models.CASCADE)

class Argument(models.Model):
    name = models.CharField(max_length=200)
    short_description = models.CharField(max_length=1000)
    long_description = models.CharField(max_length=3000)
    shape = Shape.ROUNDED_RECTANGLE
    property_claim =  models.ManyToManyField(PropertyClaim)

class EvidentialClaim(models.Model):
    name = models.CharField(max_length=200)
    short_description = models.CharField(max_length=1000)
    long_description = models.CharField(max_length=3000)
    shape = Shape.ROUNDED_RECTANGLE
    argument = models.ForeignKey(Argument, on_delete=models.CASCADE)

class Evidence(models.Model):
    name = models.CharField(max_length=200)
    short_description = models.CharField(max_length=1000)
    long_description = models.CharField(max_length=3000)
    URL = models.CharField(max_length=3000)
    shape = Shape.CYLINDER
    evidential_claim = models.ManyToManyField(EvidentialClaim)
