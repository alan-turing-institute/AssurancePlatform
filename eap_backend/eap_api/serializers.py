from rest_framework import serializers
from .models import (
    AssuranceCase,
    TopLevelNormativeGoal,
    Context,
    SystemDescription,
    PropertyClaim,
    EvidentialClaim,
    Evidence,
)


class AssuranceCaseSerializer(serializers.ModelSerializer):
    goals = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    type = serializers.CharField(default="AssuranceCase", read_only=True)

    class Meta:
        model = AssuranceCase
        fields = (
            "id",
            "type",
            "name",
            "description",
            "created_date",
            "lock_uuid",
            "goals",
        )


class TopLevelNormativeGoalSerializer(serializers.ModelSerializer):
    assurance_case_id = serializers.PrimaryKeyRelatedField(
        source="assurance_case", queryset=AssuranceCase.objects.all()
    )
    context = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    system_description = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    property_claims = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    type = serializers.CharField(default="TopLevelNormativeGoal", read_only=True)

    class Meta:
        model = TopLevelNormativeGoal
        fields = (
            "id",
            "type",
            "name",
            "short_description",
            "long_description",
            "keywords",
            "assurance_case_id",
            "context",
            "system_description",
            "property_claims",
        )


class ContextSerializer(serializers.ModelSerializer):
    goal_id = serializers.PrimaryKeyRelatedField(
        source="goal", queryset=TopLevelNormativeGoal.objects.all()
    )
    type = serializers.CharField(default="Context", read_only=True)

    class Meta:
        model = Context
        fields = (
            "id",
            "type",
            "name",
            "short_description",
            "long_description",
            "created_date",
            "goal_id",
        )


class SystemDescriptionSerializer(serializers.ModelSerializer):
    goal_id = serializers.PrimaryKeyRelatedField(
        source="goal", queryset=TopLevelNormativeGoal.objects.all()
    )
    type = serializers.CharField(default="SystemDescription", read_only=True)

    class Meta:
        model = SystemDescription
        fields = (
            "id",
            "type",
            "name",
            "short_description",
            "long_description",
            "goal_id",
        )


class PropertyClaimSerializer(serializers.ModelSerializer):
    goal_id = serializers.PrimaryKeyRelatedField(
        source="goal",
        queryset=TopLevelNormativeGoal.objects.all(),
        required=False,
    )
    property_claim_id = serializers.PrimaryKeyRelatedField(
        source="property_claim",
        queryset=PropertyClaim.objects.all(),
        required=False,
    )
    level = serializers.IntegerField(read_only=True)
    claim_type = serializers.CharField(default="Project claim")
    evidential_claims = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    property_claims = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    type = serializers.CharField(default="PropertyClaim", read_only=True)

    class Meta:
        model = PropertyClaim
        fields = (
            "id",
            "type",
            "name",
            "short_description",
            "long_description",
            "goal_id",
            "property_claim_id",
            "level",
            "claim_type",
            "evidential_claims",
            "property_claims",
        )


class EvidentialClaimSerializer(serializers.ModelSerializer):
    property_claim_id = serializers.PrimaryKeyRelatedField(
        source="property_claim",
        queryset=PropertyClaim.objects.all(),
        many=True,
    )
    evidence = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    type = serializers.CharField(default="EvidentialClaim", read_only=True)

    class Meta:
        model = EvidentialClaim
        fields = (
            "id",
            "type",
            "name",
            "short_description",
            "long_description",
            "property_claim_id",
            "evidence",
        )


class EvidenceSerializer(serializers.ModelSerializer):
    evidential_claim_id = serializers.PrimaryKeyRelatedField(
        source="evidential_claim",
        queryset=EvidentialClaim.objects.all(),
        many=True,
    )
    type = serializers.CharField(default="Evidence", read_only=True)

    class Meta:
        model = Evidence
        fields = (
            "id",
            "type",
            "name",
            "short_description",
            "long_description",
            "URL",
            "evidential_claim_id",
        )
