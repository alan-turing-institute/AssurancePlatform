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


class EvidenceSerializer(serializers.ModelSerializer):
    evidential_claim = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    class Meta:
        model = Evidence
        fields = (
            "id",
            "name",
            "short_description",
            "long_description",
            "URL",
            "evidential_claim"
        )

class EvidentialClaimSerializer(serializers.ModelSerializer):
    argument = serializers.PrimaryKeyRelatedField(many=False, read_only=True)
    evidence = EvidenceSerializer(
        many=True, read_only=True
    )
    class Meta:
        model = EvidentialClaim
        fields = (
            "id",
            "name",
            "short_description",
            "long_description",
            "argument",
            "evidence"
        )

class ArgumentSerializer(serializers.ModelSerializer):
    property_claim = serializers.PrimaryKeyRelatedField(
        many=True, read_only=True
    )
    evidential_claims = EvidentialClaimSerializer(
        many=True, read_only=True
    )
    class Meta:
        model = Argument
        fields = (
            "id",
            "name",
            "short_description",
            "long_description",
            "property_claim",
            "evidential_claims"
        )


class PropertyClaimSerializer(serializers.ModelSerializer):
    goal = serializers.PrimaryKeyRelatedField(
        many=False,
        read_only=True
    )
    arguments = ArgumentSerializer(many=True, read_only=True)
    class Meta:
        model = PropertyClaim
        fields = (
            "id",
            "name",
            "short_description",
            "long_description",
            "goal",
            "arguments"
        )

class SystemDescriptionSerializer(serializers.ModelSerializer):
    goal = serializers.PrimaryKeyRelatedField(
        many=False,
        read_only=True)
    class Meta:
        model = SystemDescription
        fields = (
            "id",
            "name",
            "short_description",
            "long_description",
            "goal"
        )

class ContextSerializer(serializers.ModelSerializer):
    goal = serializers.PrimaryKeyRelatedField(
        many=False,
        read_only=True)
    class Meta:
        model = Context
        fields = (
            "id",
            "name",
            "short_description",
            "long_description",
            "created_date",
            "goal"
        )


class TopLevelNormativeGoalSerializer(serializers.ModelSerializer):
    assurance_case = serializers.PrimaryKeyRelatedField(many=False, read_only=True)
    context = ContextSerializer(many=True, read_only=True)
    system_description = SystemDescriptionSerializer(many=True, read_only=True)
    property_claims = PropertyClaimSerializer(many=True, read_only=True)
    class Meta:
        model = TopLevelNormativeGoal
        fields = (
            "id",
            "name",
            "short_description",
            "long_description",
            "keywords",
            "assurance_case",
            "context",
            "system_description",
            "property_claims"
        )

class AssuranceCaseSerializer(serializers.ModelSerializer):
    goals = TopLevelNormativeGoalSerializer(many=True, read_only=True)
    class Meta:
        model = AssuranceCase
        fields = ("id", "name", "description", "created_date", "goals")
