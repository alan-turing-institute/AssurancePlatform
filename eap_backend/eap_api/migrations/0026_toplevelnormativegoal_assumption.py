# Generated by Django 3.2.8 on 2025-01-14 12:48

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("eap_api", "0025_alter_assurancecaseimage_assurance_case"),
    ]

    operations = [
        migrations.AddField(
            model_name="toplevelnormativegoal",
            name="assumption",
            field=models.TextField(blank=True, null=True),
        ),
    ]
