variable "location" {
  description = "The Azure region where resources will be created."
  type        = string
  default     = "uksouth"
}

variable "environment" {
  description = "The deployment environment name (e.g., prod, staging, dev)."
  type        = string
  default     = "prod"
}

variable "app_name" {
  description = "The application name prefix used across resource naming."
  type        = string
  default     = "railsignal"
}

variable "container_image" {
  description = "The container image to deploy from GitHub Container Registry."
  type        = string
  default     = "ghcr.io/foysal94/railsignal/backend:latest"
}

variable "min_replicas" {
  description = "The minimum number of replicas. Set to 0 to enable scale-to-zero (zero idle cost)."
  type        = number
  default     = 0
}

variable "max_replicas" {
  description = "The maximum number of replicas to prevent unexpected overages."
  type        = number
  default     = 1
}

variable "cpu" {
  description = "The vCPU allocation for the container instance."
  type        = number
  default     = 0.25
}

variable "memory" {
  description = "The memory allocation for the container instance (e.g., 0.5Gi)."
  type        = string
  default     = "0.5Gi"
}

variable "db_connection_string" {
  description = "The PostgreSQL connection string for Neon.tech production database."
  type        = string
  default     = ""
  sensitive   = true
}

variable "redis_url" {
  description = "The Upstash Serverless Redis TLS connection URL (rediss://...)."
  type        = string
  default     = ""
  sensitive   = true
}

variable "resend_api_key" {
  description = "API key for the Resend transactional email dispatching service."
  type        = string
  default     = ""
  sensitive   = true
}

variable "email_from" {
  description = "The sender email address for transactional alerts."
  type        = string
  default     = "RailSignal Alerts <onboarding@resend.dev>"
}

variable "job_secret" {
  description = "Secret key protecting internal job invocation endpoints."
  type        = string
  default     = ""
  sensitive   = true
}

variable "static_web_app_location" {
  description = "The Azure region for the Static Web App host (westeurope, eastus2, centralus)."
  type        = string
  default     = "westeurope"
}
