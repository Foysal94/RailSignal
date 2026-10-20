# Azure Container App (Unified Fastify API & BullMQ Worker Host)
resource "azurerm_container_app" "api" {
  name                         = "${var.app_name}-api"
  container_app_environment_id = azurerm_container_app_environment.cae.id
  resource_group_name          = azurerm_resource_group.rg.name
  revision_mode                = "Single"

  secret {
    name  = "neon-db-connection"
    value = var.db_connection_string != "" ? var.db_connection_string : "none"
  }

  secret {
    name  = "upstash-redis-url"
    value = var.redis_url != "" ? var.redis_url : "none"
  }

  secret {
    name  = "resend-api-key"
    value = var.resend_api_key != "" ? var.resend_api_key : "none"
  }

  secret {
    name  = "job-secret"
    value = var.job_secret != "" ? var.job_secret : "none"
  }

  template {
    min_replicas = var.min_replicas
    max_replicas = var.max_replicas

    container {
      name   = "${var.app_name}-api"
      image  = var.container_image
      cpu    = var.cpu
      memory = var.memory

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "PORT"
        value = "3000"
      }

      env {
        name  = "HOST"
        value = "0.0.0.0"
      }

      env {
        name  = "EMAIL_FROM"
        value = var.email_from
      }

      env {
        name        = "DATABASE_URL"
        secret_name = "neon-db-connection"
      }

      env {
        name        = "REDIS_URL"
        secret_name = "upstash-redis-url"
      }

      env {
        name        = "RESEND_API_KEY"
        secret_name = "resend-api-key"
      }

      env {
        name        = "JOB_SECRET"
        secret_name = "job-secret"
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = 3000
    transport        = "auto"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  tags = azurerm_resource_group.rg.tags
}

# Azure Container App Job (Friday 09:00 UK Disruption Ingestion & Notification Dispatch Runner)
resource "azurerm_container_app_job" "sync_disruptions" {
  name                         = "${var.app_name}-sync-job"
  location                     = azurerm_resource_group.rg.location
  resource_group_name          = azurerm_resource_group.rg.name
  container_app_environment_id = azurerm_container_app_environment.cae.id

  replica_timeout_in_seconds = 180
  replica_retry_limit        = 1

  schedule_trigger_config {
    cron_expression          = "0 9 * * 5"
    parallelism              = 1
    replica_completion_count = 1
  }

  secret {
    name  = "neon-db-connection"
    value = var.db_connection_string != "" ? var.db_connection_string : "none"
  }

  secret {
    name  = "upstash-redis-url"
    value = var.redis_url != "" ? var.redis_url : "none"
  }

  secret {
    name  = "resend-api-key"
    value = var.resend_api_key != "" ? var.resend_api_key : "none"
  }

  secret {
    name  = "job-secret"
    value = var.job_secret != "" ? var.job_secret : "none"
  }

  template {
    container {
      name    = "${var.app_name}-sync-runner"
      image   = var.container_image
      cpu     = var.cpu
      memory  = var.memory
      command = ["node", "dist/jobs/syncDisruptionsRunner.js"]

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "EMAIL_FROM"
        value = var.email_from
      }

      env {
        name        = "DATABASE_URL"
        secret_name = "neon-db-connection"
      }

      env {
        name        = "REDIS_URL"
        secret_name = "upstash-redis-url"
      }

      env {
        name        = "RESEND_API_KEY"
        secret_name = "resend-api-key"
      }

      env {
        name        = "JOB_SECRET"
        secret_name = "job-secret"
      }
    }
  }

  tags = azurerm_resource_group.rg.tags
}
