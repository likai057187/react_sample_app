resource "google_service_account" "vm_sa" {
  account_id   = "${local.app_name}-vm"
  display_name = "Chromatic Resonance VM Service Account"
}

resource "google_artifact_registry_repository_iam_member" "vm_reader" {
  location   = google_artifact_registry_repository.docker.location
  repository = google_artifact_registry_repository.docker.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.vm_sa.email}"
}

resource "google_compute_instance" "vm" {
  name         = "${local.app_name}-vm"
  machine_type = "e2-micro"
  zone         = var.zone

  tags = ["${local.app_name}-web"]

  labels = {
    app     = local.app_name
    managed = "terraform"
  }

  deletion_protection = false

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = 30
      type  = "pd-standard"
    }
  }

  network_interface {
    network = "default"
    access_config {}
  }

  service_account {
    email  = google_service_account.vm_sa.email
    scopes = ["cloud-platform"]
  }

  metadata = {
    startup-script = templatefile("${path.module}/startup.sh", {
      project_id                = var.project_id
      region                    = var.region
      app_name                  = local.app_name
      roboflow_model_id         = var.roboflow_model_id
      roboflow_inference_url    = var.roboflow_inference_url
      discovery_match_threshold = var.discovery_match_threshold
    })
  }

  depends_on = [
    google_project_service.compute,
    google_secret_manager_secret_version.app_api_key,
    google_secret_manager_secret_version.db_password,
    google_secret_manager_secret_iam_member.api_key_access,
    google_secret_manager_secret_iam_member.db_password_access,
    google_artifact_registry_repository.docker,
    google_artifact_registry_repository_iam_member.vm_reader,
  ]
}
