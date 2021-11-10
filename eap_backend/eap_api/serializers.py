from rest_framework import serializers
from .models import (
    AssuranceCase,
    TopLevelNormativeGoal,
    Context,
    SystemDescription,
    PropertyClaim,
    Argument,
    EvidentialClaim,
    Evidence,
)


class AssuranceCaseSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = AssuranceCase
        fields = ["name", "description", "created_date"]


class TopLevelNormativeGoalSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = TopLevelNormativeGoal
        fields = ["name", "short_description", "long_description", "keywords"]


class ContextSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Context
        fields = [
            "name",
            "short_description",
            "long_description",
            "created_date"
        ]


class SystemDescriptionSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = SystemDescription
        fields = ["name", "short_description", "long_description"]


class PropertyClaimSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = PropertyClaim
        fields = ["name", "short_description", "long_description"]

class ArgumentSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Argument
        fields = ["name", "short_description", "long_description"]

class EvidentialClaimSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = EvidentialClaim
        fields = ["name", "short_description", "long_description"]


class EvidenceSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Evidence
        fields = ["name", "short_description", "long_description", "URL"]
