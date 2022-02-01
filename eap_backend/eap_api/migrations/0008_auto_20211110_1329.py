# Generated by Django 3.2.8 on 2021-11-10 13:29

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('eap_api', '0007_alter_toplevelnormativegoal_assurance_case'),
    ]

    operations = [
        migrations.AlterField(
            model_name='context',
            name='goal',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='context', to='eap_api.toplevelnormativegoal'),
        ),
        migrations.AlterField(
            model_name='systemdescription',
            name='goal',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='system_description', to='eap_api.toplevelnormativegoal'),
        ),
    ]