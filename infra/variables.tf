variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "region" {
  description = "GCP region for Cloud Run, Artifact Registry, and Cloud SQL."
  type        = string
  default     = "us-central1"
}

variable "app_name" {
  description = "Resource name prefix."
  type        = string
  default     = "chromatic-resonance"
}

variable "container_image" {
  description = "Container image to deploy to Cloud Run. Build and push this with infra/deploy.ps1."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "app_api_key" {
  description = "API key shared by the Expo web client and Fastify API."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.app_api_key) >= 32
    error_message = "app_api_key should be at least 32 characters."
  }
}

variable "db_password" {
  description = "PostgreSQL password for the app user."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.db_password) >= 12
    error_message = "db_password must be at least 12 characters."
  }
}

variable "db_tier" {
  description = "Cloud SQL instance tier. db-custom-1-3840 is a conservative fit for about 100 concurrent event users."
  type        = string
  default     = "db-custom-1-3840"
}

variable "db_disk_size_gb" {
  description = "Cloud SQL SSD disk size in GB."
  type        = number
  default     = 20
}

variable "cloud_run_cpu" {
  description = "Cloud Run CPU per container instance."
  type        = string
  default     = "1"
}

variable "cloud_run_memory" {
  description = "Cloud Run memory per container instance."
  type        = string
  default     = "1Gi"
}

variable "cloud_run_concurrency" {
  description = "Maximum concurrent requests per Cloud Run container instance."
  type        = number
  default     = 100
}

variable "cloud_run_min_instances" {
  description = "Minimum warm Cloud Run instances."
  type        = number
  default     = 1
}

variable "cloud_run_max_instances" {
  description = "Maximum Cloud Run instances. Keep at 1 unless Socket.IO is moved to a shared pub/sub adapter."
  type        = number
  default     = 1
}

variable "roboflow_api_key" {
  description = "Optional Roboflow API key for Discovery image classification."
  type        = string
  sensitive   = true
  default     = ""
}

variable "roboflow_model_id" {
  description = "Optional Roboflow model id, e.g. artwork-classification-hldjp/2."
  type        = string
  default     = ""
}

variable "roboflow_inference_url" {
  description = "Optional full Roboflow inference URL. If set, the server uses this before roboflow_model_id."
  type        = string
  default     = ""
}

variable "discovery_match_threshold" {
  description = "Minimum Roboflow confidence required for a Discovery match."
  type        = number
  default     = 0.4
}
