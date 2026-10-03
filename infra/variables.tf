variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "region" {
  description = "GCP region for Artifact Registry."
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone for the VM."
  type        = string
  default     = "us-central1-a"
}

variable "app_name" {
  description = "Resource name prefix."
  type        = string
  default     = "chromatic-resonance"
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
