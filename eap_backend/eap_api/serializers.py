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


class AssuranceCaseSerializer(serializers.ModelSerializer):
    goals = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    class Meta:
        model = AssuranceCase
        fields = ["id", "name", "description", "created_date", "goals"]


class TopLevelNormativeGoalSerializer(serializers.ModelSerializer):
    assurance_case = AssuranceCaseSerializer(many=False, read_only=True)
    assurance_case_id = serializers.PrimaryKeyRelatedField(source="assurance_case",queryset=AssuranceCase.objects.all(),write_only=True)
#    context = serializers.PrimaryKeyRelatedField(many=False, read_only=True)
#    system_description = serializers.PrimaryKeyRelatedField(many=False, read_only=True)
    class Meta:
        model = TopLevelNormativeGoal
        fields = [
            "id",
            "name",
            "short_description",
            "long_description",
            "keywords",
            "assurance_case",
            "assurance_case_id",
#            "context",
#            "system_description"
        ]


class ContextSerializer(serializers.ModelSerializer):
    goal = TopLevelNormativeGoalSerializer(many=False, read_only=True)
    goal_id = serializers.PrimaryKeyRelatedField(source="goal", queryset=TopLevelNormativeGoal.objects.all(), write_only=True)
    class Meta:
        model = Context
        fields = [
            "id",
            "name",
            "short_description",
            "long_description",
            "created_date",
            "goal",
            "goal_id"
        ]


class SystemDescriptionSerializer(serializers.ModelSerializer):
    goal = TopLevelNormativeGoalSerializer(many=False, read_only=True)
    goal_id = serializers.PrimaryKeyRelatedField(source="goal", queryset=TopLevelNormativeGoal.objects.all(), write_only=True)
    class Meta:
        model = SystemDescription
        fields = [
            "id",
            "name",
            "short_description",
            "long_description",
            "goal",
            "goal_id"
        ]


class PropertyClaimSerializer(serializers.ModelSerializer):
    class Meta:
        model = PropertyClaim
        fields = ["name", "short_description", "long_description"]

class ArgumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Argument
        fields = ["name", "short_description", "long_description"]

class EvidentialClaimSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvidentialClaim
        fields = ["name", "short_description", "long_description"]


class EvidenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Evidence
        fields = ["name", "short_description", "long_description", "URL"]
