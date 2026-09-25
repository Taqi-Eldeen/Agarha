terraform {
  required_version = ">= 1.9"
  required_providers {
    aws        = { source = "hashicorp/aws", version = "~> 6.66" }
    cloudflare = { source = "cloudflare/cloudflare", version = "~> 5.25" }
    random     = { source = "hashicorp/random", version = "~> 3.9" }
  }
  # State per environment: terraform init -backend-config=envs/<env>.backend.hcl
  backend "s3" {}
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = { Project = "agarha", Environment = var.environment, ManagedBy = "terraform" }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
