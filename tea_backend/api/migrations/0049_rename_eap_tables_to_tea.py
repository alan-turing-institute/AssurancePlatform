"""
Rename database tables to remove legacy 'eap_' prefix.

This migration renames all tables from eap_api_* to api_* and eap_websockets_*
to websockets_* to align with the current app naming (TEA not EAP).
"""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0048_fix_migration_history"),
        ("websockets", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql=[
                # Core model tables
                "ALTER TABLE IF EXISTS eap_api_eapuser RENAME TO api_eapuser;",
                "ALTER TABLE IF EXISTS eap_api_eapgroup RENAME TO api_eapgroup;",
                "ALTER TABLE IF EXISTS eap_api_assurancecase RENAME TO api_assurancecase;",
                "ALTER TABLE IF EXISTS eap_api_toplevelnormativegoal RENAME TO api_toplevelnormativegoal;",
                "ALTER TABLE IF EXISTS eap_api_context RENAME TO api_context;",
                "ALTER TABLE IF EXISTS eap_api_strategy RENAME TO api_strategy;",
                "ALTER TABLE IF EXISTS eap_api_propertyclaim RENAME TO api_propertyclaim;",
                "ALTER TABLE IF EXISTS eap_api_evidence RENAME TO api_evidence;",
                "ALTER TABLE IF EXISTS eap_api_comment RENAME TO api_comment;",
                "ALTER TABLE IF EXISTS eap_api_githubrepository RENAME TO api_githubrepository;",
                "ALTER TABLE IF EXISTS eap_api_casestudy RENAME TO api_casestudy;",
                "ALTER TABLE IF EXISTS eap_api_publishedassurancecase RENAME TO api_publishedassurancecase;",
                "ALTER TABLE IF EXISTS eap_api_assurancecaseimage RENAME TO api_assurancecaseimage;",
                "ALTER TABLE IF EXISTS eap_api_casestudyfeatureimage RENAME TO api_casestudyfeatureimage;",
                # Many-to-many relationship tables
                "ALTER TABLE IF EXISTS eap_api_eapuser_groups RENAME TO api_eapuser_groups;",
                "ALTER TABLE IF EXISTS eap_api_eapuser_user_permissions RENAME TO api_eapuser_user_permissions;",
                "ALTER TABLE IF EXISTS eap_api_eapgroup_member RENAME TO api_eapgroup_member;",
                "ALTER TABLE IF EXISTS eap_api_assurancecase_edit_groups RENAME TO api_assurancecase_edit_groups;",
                "ALTER TABLE IF EXISTS eap_api_assurancecase_review_groups RENAME TO api_assurancecase_review_groups;",
                "ALTER TABLE IF EXISTS eap_api_assurancecase_view_groups RENAME TO api_assurancecase_view_groups;",
                "ALTER TABLE IF EXISTS eap_api_evidence_property_claim RENAME TO api_evidence_property_claim;",
                "ALTER TABLE IF EXISTS eap_api_casestudy_assurance_cases RENAME TO api_casestudy_assurance_cases;",
                # Websockets app table
                "ALTER TABLE IF EXISTS eap_websockets_assurancecaseconnection RENAME TO websockets_assurancecaseconnection;",
            ],
            reverse_sql=[
                # Reverse operations for rollback
                # Core model tables
                "ALTER TABLE IF EXISTS api_eapuser RENAME TO eap_api_eapuser;",
                "ALTER TABLE IF EXISTS api_eapgroup RENAME TO eap_api_eapgroup;",
                "ALTER TABLE IF EXISTS api_assurancecase RENAME TO eap_api_assurancecase;",
                "ALTER TABLE IF EXISTS api_toplevelnormativegoal RENAME TO eap_api_toplevelnormativegoal;",
                "ALTER TABLE IF EXISTS api_context RENAME TO eap_api_context;",
                "ALTER TABLE IF EXISTS api_strategy RENAME TO eap_api_strategy;",
                "ALTER TABLE IF EXISTS api_propertyclaim RENAME TO eap_api_propertyclaim;",
                "ALTER TABLE IF EXISTS api_evidence RENAME TO eap_api_evidence;",
                "ALTER TABLE IF EXISTS api_comment RENAME TO eap_api_comment;",
                "ALTER TABLE IF EXISTS api_githubrepository RENAME TO eap_api_githubrepository;",
                "ALTER TABLE IF EXISTS api_casestudy RENAME TO eap_api_casestudy;",
                "ALTER TABLE IF EXISTS api_publishedassurancecase RENAME TO eap_api_publishedassurancecase;",
                "ALTER TABLE IF EXISTS api_assurancecaseimage RENAME TO eap_api_assurancecaseimage;",
                "ALTER TABLE IF EXISTS api_casestudyfeatureimage RENAME TO eap_api_casestudyfeatureimage;",
                # Many-to-many relationship tables
                "ALTER TABLE IF EXISTS api_eapuser_groups RENAME TO eap_api_eapuser_groups;",
                "ALTER TABLE IF EXISTS api_eapuser_user_permissions RENAME TO eap_api_eapuser_user_permissions;",
                "ALTER TABLE IF EXISTS api_eapgroup_member RENAME TO eap_api_eapgroup_member;",
                "ALTER TABLE IF EXISTS api_assurancecase_edit_groups RENAME TO eap_api_assurancecase_edit_groups;",
                "ALTER TABLE IF EXISTS api_assurancecase_review_groups RENAME TO eap_api_assurancecase_review_groups;",
                "ALTER TABLE IF EXISTS api_assurancecase_view_groups RENAME TO eap_api_assurancecase_view_groups;",
                "ALTER TABLE IF EXISTS api_evidence_property_claim RENAME TO eap_api_evidence_property_claim;",
                "ALTER TABLE IF EXISTS api_casestudy_assurance_cases RENAME TO eap_api_casestudy_assurance_cases;",
                # Websockets app table
                "ALTER TABLE IF EXISTS websockets_assurancecaseconnection RENAME TO eap_websockets_assurancecaseconnection;",
            ],
            state_operations=None,
        ),
    ]
