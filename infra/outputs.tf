output "resource_group_name" {
  description = "The name of the provisioned Azure Resource Group."
  value       = azurerm_resource_group.rg.name
}

output "container_app_environment_name" {
  description = "The name of the provisioned Azure Container App Environment."
  value       = azurerm_container_app_environment.cae.name
}

output "container_app_name" {
  description = "The name of the provisioned Azure Container App."
  value       = azurerm_container_app.api.name
}

output "container_app_fqdn" {
  description = "The fully qualified domain name (public HTTPS endpoint) of the API."
  value       = azurerm_container_app.api.latest_revision_fqdn
}

output "container_app_job_name" {
  description = "The name of the provisioned ACA Scheduled Job."
  value       = azurerm_container_app_job.sync_disruptions.name
}

output "static_web_app_name" {
  description = "The name of the Azure Static Web App."
  value       = azurerm_static_web_app.client.name
}

output "static_web_app_default_host_name" {
  description = "The default public hostname of the frontend Static Web App."
  value       = azurerm_static_web_app.client.default_host_name
}

output "static_web_app_api_key" {
  description = "The deployment token for Azure Static Web App."
  value       = azurerm_static_web_app.client.api_key
  sensitive   = true
}
