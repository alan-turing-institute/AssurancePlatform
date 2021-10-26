from django.db import models
from django.utils import timezone
import datetime

# Create your models here.

class AssuranceCase(models.Model):
    name = models.CharField(max_length=200)
    description = models.CharField(max_length=1000)
    shape = models.IntegerField(default=0)
    created_date = models.DateTimeField(auto_now_add=True)
    def __str__(self):
        return self.name
    def was_published_recently(self):
        return self.created_date >= timezone.now() - datetime.timedelta(days=1)

class TopLevelNormativeGoal(models.Model):
    name = models.CharField(max_length=200)
    short_description = models.CharField(max_length=1000)
    long_description = models.CharField(max_length=3000)
    keywords = models.CharField(max_length=3000)
    shape = models.IntegerField(default=0)
    assurance_case = models.ForeignKey(AssuranceCase, on_delete=models.CASCADE)
    def __str__(self):
        return self.name


class Context(models.Model):
    name = models.CharField(max_length=200)
    short_description = models.CharField(max_length=1000)
    long_description = models.CharField(max_length=3000)
    shape = models.IntegerField(default=0)
    created_date = models.DateTimeField(auto_now_add=True)
    goal_id = models.ForeignKey(TopLevelNormativeGoal, on_delete=models.CASCADE)

class SystemDescription(models.Model):
    name = models.CharField(max_length=200)
    short_description = models.CharField(max_length=1000)
    long_description = models.CharField(max_length=3000)
    shape = models.IntegerField(default=0)
    goal_id = models.ForeignKey(TopLevelNormativeGoal, on_delete=models.CASCADE)

class PropertyClaim(models.Model):
    name = models.CharField(max_length=200)
    short_description = models.CharField(max_length=1000)
    long_description = models.CharField(max_length=3000)
    shape = models.IntegerField(default=0)
    goal_id = models.ForeignKey(TopLevelNormativeGoal, on_delete=models.CASCADE)

class Argument(models.Model):
    name = models.CharField(max_length=200)
    short_description = models.CharField(max_length=1000)
    long_description = models.CharField(max_length=3000)
    shape = models.IntegerField(default=0)
    goal_id = models.ForeignKey(PropertyClaim, on_delete=models.CASCADE)

class EvidentialClaim(models.Model):
    name = models.CharField(max_length=200)
    short_description = models.CharField(max_length=1000)
    long_description = models.CharField(max_length=3000)
    shape = models.IntegerField(default=0)
    goal_id = models.ForeignKey(Argument, on_delete=models.CASCADE)

class Evidence(models.Model):
    name = models.CharField(max_length=200)
    short_description = models.CharField(max_length=1000)
    long_description = models.CharField(max_length=3000)
    URL = models.CharField(max_length=3000)
    shape = models.IntegerField(default=0)
    goal_id = models.ForeignKey(EvidentialClaim, on_delete=models.CASCADE)
