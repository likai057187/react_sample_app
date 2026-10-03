output "vm_ip" {
  description = "Public IP address of the VM (ephemeral — changes on reboot)"
  value       = google_compute_instance.vm.network_interface[0].access_config[0].nat_ip
}

output "web_url" {
  description = "URL to access the web app"
  value       = "http://${google_compute_instance.vm.network_interface[0].access_config[0].nat_ip}"
}

output "domain_url" {
  description = "Production URL after DNS and SSL are configured"
  value       = "https://auction.rhythmmm.org"
}

output "ssh_command" {
  description = "SSH into the VM"
  value       = "gcloud compute ssh ${local.app_name}-vm --zone=${var.zone} --project=${var.project_id}"
}

output "registry" {
  description = "Artifact Registry URL for Docker images"
  value       = "${local.registry_host}/${var.project_id}/${google_artifact_registry_repository.docker.repository_id}"
}

output "artifact_registry" {
  description = "Alias for registry output (used by deploy.ps1)"
  value       = "${local.registry_host}/${var.project_id}/${google_artifact_registry_repository.docker.repository_id}"
}
