resource "google_compute_firewall" "allow_http" {
  name        = "${local.app_name}-allow-http"
  network     = "default"
  description = "Allow HTTP traffic to Chromatic Resonance VM"
  direction   = "INGRESS"

  allow {
    protocol = "tcp"
    ports    = ["80"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["${local.app_name}-web"]

  depends_on = [google_project_service.compute]
}

resource "google_compute_firewall" "allow_https" {
  name        = "${local.app_name}-allow-https"
  network     = "default"
  description = "Allow HTTPS traffic to Chromatic Resonance VM"
  direction   = "INGRESS"

  allow {
    protocol = "tcp"
    ports    = ["443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["${local.app_name}-web"]

  depends_on = [google_project_service.compute]
}
