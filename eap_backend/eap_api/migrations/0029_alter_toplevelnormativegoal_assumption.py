# Generated by Django 3.2.8 on 2025-01-14 12:59

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("eap_api", "0028_alter_toplevelnormativegoal_assumption"),
    ]

    operations = [
        migrations.AlterField(
            model_name="toplevelnormativegoal",
            name="assumption",
            field=models.TextField(blank=True, default=""),
        ),
    ]
