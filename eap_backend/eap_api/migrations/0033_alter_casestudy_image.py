# Generated by Django 3.2.8 on 2025-02-26 10:18

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("eap_api", "0032_casestudy_owner"),
    ]

    operations = [
        migrations.AlterField(
            model_name="casestudy",
            name="image",
            field=models.ImageField(
                blank=True, null=True, upload_to="case_study_images/"
            ),
        ),
    ]
