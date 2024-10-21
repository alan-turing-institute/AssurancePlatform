# Generated by Django 3.2.8 on 2024-09-26 12:31

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("eap_api", "0023_assurancecaseimage"),
    ]

    operations = [
        migrations.AddField(
            model_name="comment",
            name="context",
            field=models.ForeignKey(
                default=None,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="comments",
                to="eap_api.context",
            ),
        ),
        migrations.AddField(
            model_name="comment",
            name="evidence",
            field=models.ForeignKey(
                default=None,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="comments",
                to="eap_api.evidence",
            ),
        ),
        migrations.AddField(
            model_name="comment",
            name="goal",
            field=models.ForeignKey(
                default=None,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="comments",
                to="eap_api.toplevelnormativegoal",
            ),
        ),
        migrations.AddField(
            model_name="comment",
            name="property_claim",
            field=models.ForeignKey(
                default=None,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="comments",
                to="eap_api.propertyclaim",
            ),
        ),
        migrations.AddField(
            model_name="comment",
            name="strategy",
            field=models.ForeignKey(
                default=None,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="comments",
                to="eap_api.strategy",
            ),
        ),
        migrations.AlterField(
            model_name="comment",
            name="assurance_case",
            field=models.ForeignKey(
                default=None,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="comments",
                to="eap_api.assurancecase",
            ),
        ),
    ]