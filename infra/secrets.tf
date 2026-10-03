resource "google_secret_manager_secret" "app_api_key" {
  secret_id = "${local.app_name}-api-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "app_api_key" {
  secret      = google_secret_manager_secret.app_api_key.id
  secret_data = var.app_api_key
}

resource "google_secret_manager_secret" "db_password" {
  secret_id = "${local.app_name}-db-password"

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = var.db_password
}

resource "google_secret_manager_secret" "roboflow_api_key" {
  count     = var.roboflow_api_key == "" ? 0 : 1
  secret_id = "${local.app_name}-roboflow-api-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "roboflow_api_key" {
  count       = var.roboflow_api_key == "" ? 0 : 1
  secret      = google_secret_manager_secret.roboflow_api_key[0].id
  secret_data = var.roboflow_api_key
}

resource "google_secret_manager_secret_iam_member" "api_key_access" {
  secret_id = google_secret_manager_secret.app_api_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.vm_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "db_password_access" {
  secret_id = google_secret_manager_secret.db_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.vm_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "roboflow_api_key_access" {
  count     = var.roboflow_api_key == "" ? 0 : 1
  secret_id = google_secret_manager_secret.roboflow_api_key[0].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.vm_sa.email}"
}
