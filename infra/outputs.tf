output "artifact_registry" {
  description = "Artifact Registry Docker repository."
  value       = "${local.registry_host}/${var.project_id}/${google_artifact_registry_repository.docker.repository_id}"
}

output "cloud_run_url" {
  description = "Public HTTPS URL for the web app and API."
  value       = google_cloud_run_v2_service.app.uri
}

output "api_base_url" {
  description = "API base URL."
  value       = "${google_cloud_run_v2_service.app.uri}/api"
}

output "cloud_sql_connection_name" {
  description = "Cloud SQL connection name used by Cloud Run."
  value       = google_sql_database_instance.postgres.connection_name
}

output "selected_runtime_size" {
  description = "Runtime size selected for about 100 concurrent users."
  value       = "Cloud Run ${var.cloud_run_cpu} vCPU / ${var.cloud_run_memory}, concurrency ${var.cloud_run_concurrency}; Cloud SQL ${var.db_tier}"
}
