resource "google_service_account" "cloud_run" {
  account_id   = "${local.app_name}-run"
  display_name = "Chromatic Resonance Cloud Run"
}

resource "google_project_iam_member" "cloud_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

resource "google_cloud_run_v2_service" "app" {
  name     = local.app_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account                  = google_service_account.cloud_run.email
    timeout                          = "300s"
    max_instance_request_concurrency = var.cloud_run_concurrency

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    containers {
      image = var.container_image

      ports {
        container_port = 3000
      }

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }

        # Keep CPU allocated between requests so Socket.IO connections and timers
        # stay responsive during the live event.
        cpu_idle = false
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name = "API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app_api_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "DATABASE_URL"
        value = format(
          "postgresql://%s:%s@localhost/%s?host=/cloudsql/%s&schema=public",
          google_sql_user.app.name,
          urlencode(var.db_password),
          google_sql_database.app.name,
          google_sql_database_instance.postgres.connection_name,
        )
      }

      env {
        name  = "ROBOFLOW_MODEL_ID"
        value = var.roboflow_model_id
      }

      env {
        name  = "ROBOFLOW_INFERENCE_URL"
        value = var.roboflow_inference_url
      }

      env {
        name  = "DISCOVERY_MATCH_THRESHOLD"
        value = tostring(var.discovery_match_threshold)
      }

      dynamic "env" {
        for_each = var.roboflow_api_key == "" ? [] : [1]
        content {
          name = "ROBOFLOW_API_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.roboflow_api_key[0].secret_id
              version = "latest"
            }
          }
        }
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.postgres.connection_name]
      }
    }
  }

  depends_on = [
    google_project_service.run,
    google_project_iam_member.cloud_sql_client,
    google_secret_manager_secret_iam_member.api_key_access,
    google_secret_manager_secret_iam_member.db_password_access,
    google_sql_database.app,
    google_sql_user.app,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  project  = var.project_id
  location = google_cloud_run_v2_service.app.location
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
