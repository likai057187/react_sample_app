resource "google_sql_database_instance" "postgres" {
  name                = "${local.app_name}-postgres"
  region              = var.region
  database_version    = "POSTGRES_16"
  deletion_protection = true

  settings {
    tier              = var.db_tier
    availability_type = "ZONAL"
    disk_type         = "PD_SSD"
    disk_size         = var.db_disk_size_gb
    disk_autoresize   = true

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "09:00"
    }

    ip_configuration {
      # Cloud SQL requires at least one connectivity mode. Cloud Run connects
      # through the Cloud SQL connector/Unix socket; no authorized networks are
      # configured, so this is not opened for direct unauthenticated access.
      ipv4_enabled = true
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }
  }

  depends_on = [google_project_service.sqladmin]
}

resource "google_sql_database" "app" {
  name     = local.db_name
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "app" {
  name     = "auction"
  instance = google_sql_database_instance.postgres.name
  password = var.db_password
}
