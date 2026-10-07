from django.contrib import admin
from django.urls import path, re_path

from catalogue import views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/clients/", views.clients),
    path("api/clients/<int:client_id>/", views.client_detail),
    path("api/clients/<int:client_id>/master/", views.client_master),
    path("api/clients/<int:client_id>/societies/", views.client_societies),
    path("api/clients/<int:client_id>/societies/<str:society>/", views.client_society),
    path("api/clients/<int:client_id>/tasks/", views.client_tasks),
    path("api/clients/<int:client_id>/tasks/bulk/", views.tasks_bulk),
    path("api/clients/<int:client_id>/works/", views.client_works),
    path("api/clients/<int:client_id>/export/<str:name>/", views.client_export),
    path("api/tasks/<int:task_id>/", views.task_detail),
    path("api/works/<int:work_id>/", views.work_detail),
    path("api/runs/", views.runs),
    path("api/runs/<int:run_id>/", views.run_detail),
    path("api/runs/<int:run_id>/files/<str:kind>/", views.upload),
    path("api/runs/<int:run_id>/decisions/", views.decide),
    path("api/runs/<int:run_id>/master-edits/", views.master_edits),
    path("api/runs/<int:run_id>/song-flags/", views.song_flags),
    path("api/runs/<int:run_id>/verify/", views.verify),
    path("api/runs/<int:run_id>/export/<str:name>/", views.download),
    re_path(r"^(?P<path>(?!api/|admin/).*)$", views.frontend),
]
