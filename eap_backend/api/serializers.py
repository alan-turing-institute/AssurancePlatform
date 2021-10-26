from rest_framework import serializers
from .models import AssuranceCase, TopLevelNormativeGoal

class AssuranceCaseSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = AssuranceCase
        fields = ['name','description','shape','created_date']

class TopLevelNormativeGoalSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = TopLevelNormativeGoal
        fields = ['name','short_description','long_description','keywords','shape']

class Context(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = TopLevelNormativeGoal
        fields = ['name','short_description','long_description','created_date','shape']

class SystemDescription(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = TopLevelNormativeGoal
        fields = ['name','short_description','long_description','shape']

class PropertyClaim(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = TopLevelNormativeGoal
        fields = ['name','short_description','long_description','shape']

class EvidentialClaim(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = TopLevelNormativeGoal
        fields = ['name','short_description','long_description','shape']

class Evidence(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = TopLevelNormativeGoal
        fields = ['name','short_description','long_description','URL','shape']
