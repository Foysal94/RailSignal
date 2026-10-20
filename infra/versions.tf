terraform {
  required_version = ">= 1.7.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.100"
    }
  }

  backend "azurerm" {
    resource_group_name  = "rg-railsignal-tfstate"
    storage_account_name = "strailsignaltf"
    container_name       = "tfstate"
    key                  = "railsignal.terraform.tfstate"
    use_oidc             = true
  }
}

provider "azurerm" {
  skip_provider_registration = true
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }
}
