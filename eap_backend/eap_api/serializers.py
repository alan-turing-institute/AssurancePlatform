from rest_framework import serializers
from .models import AssuranceCase, TopLevelNormativeGoal, Context, SystemDescription, PropertyClaim, EvidentialClaim, Evidence

class AssuranceCaseSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = AssuranceCase
        fields = ['name','description','shape','created_date']

class TopLevelNormativeGoalSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = TopLevelNormativeGoal
        fields = ['name','short_description','long_description','keywords','shape']

class ContextSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Context
        fields = ['name','short_description','long_description','created_date','shape']

class SystemDescriptionSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = SystemDescription
        fields = ['name','short_description','long_description','shape']

class PropertyClaimSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = PropertyClaim
        fields = ['name','short_description','long_description','shape']

class EvidentialClaimSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = EvidentialClaim
        fields = ['name','short_description','long_description','shape']

class EvidenceSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Evidence
        fields = ['name','short_description','long_description','URL','shape']
