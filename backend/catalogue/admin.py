from django.contrib import admin

from .models import Client, LinkDecision, Registration, Run, SourceFile, Task, Work

for model in (Client, Run, SourceFile, LinkDecision, Work, Registration, Task):
    admin.site.register(model)
