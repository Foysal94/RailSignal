locals {
  resource_suffix = "${var.app_name}-${var.environment}"
}

# 1. Resource Group
resource "azurerm_resource_group" "rg" {
  name     = "rg-${local.resource_suffix}"
  location = var.location

  tags = {
    Environment = var.environment
    Application = var.app_name
    ManagedBy   = "Terraform"
  }
}

# 2. Log Analytics Workspace (stdout/stderr log retention)
resource "azurerm_log_analytics_workspace" "law" {
  name                = "law-${local.resource_suffix}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "PerGB2018"
  retention_in_days   = 30

  tags = azurerm_resource_group.rg.tags
}

# 3. Application Insights (APM, distributed tracing, error tracking)
resource "azurerm_application_insights" "appi" {
  name                = "appi-${local.resource_suffix}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  workspace_id        = azurerm_log_analytics_workspace.law.id
  application_type    = "web"

  tags = azurerm_resource_group.rg.tags
}

# 4. Azure Container App Environment (Managed serverless runtime host)
resource "azurerm_container_app_environment" "cae" {
  name                       = "cae-${local.resource_suffix}"
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.law.id

  tags = azurerm_resource_group.rg.tags
}

# 5. Azure Static Web App (React 19 Frontend Host - Free Tier)
resource "azurerm_static_web_app" "client" {
  name                = "swa-${local.resource_suffix}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.static_web_app_location
  sku_tier            = "Free"
  sku_size            = "Free"

  tags = azurerm_resource_group.rg.tags
}
