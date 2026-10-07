from django.db import migrations


def forwards(apps, schema_editor):
    """Existing reports carried the master as a run file: make it the client's master and register IPRS."""
    Run = apps.get_model("catalogue", "Run")
    SourceFile = apps.get_model("catalogue", "SourceFile")
    MasterFile = apps.get_model("catalogue", "MasterFile")
    ClientSociety = apps.get_model("catalogue", "ClientSociety")
    for run in Run.objects.exclude(client=None):
        ClientSociety.objects.get_or_create(client_id=run.client_id, society="IPRS")
        if SourceFile.objects.filter(run=run, kind="prs").exists():
            ClientSociety.objects.get_or_create(client_id=run.client_id, society="PRS")
        master = SourceFile.objects.filter(run=run, kind="master").order_by("-uploaded_at").first()
        if master and not MasterFile.objects.filter(client_id=run.client_id).exists():
            MasterFile.objects.create(client_id=run.client_id, file=master.file.name, original_name=master.original_name)


class Migration(migrations.Migration):
    dependencies = [("catalogue", "0005_society_workspaces")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
