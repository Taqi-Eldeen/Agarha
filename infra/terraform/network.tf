data "aws_availability_zones" "available" {
  state = "available"
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 6.7"

  name = local.name
  cidr = "10.40.0.0/16"
  azs  = slice(data.aws_availability_zones.available.names, 0, 3)

  public_subnets   = ["10.40.0.0/24", "10.40.1.0/24", "10.40.2.0/24"]
  private_subnets  = ["10.40.10.0/24", "10.40.11.0/24", "10.40.12.0/24"]
  database_subnets = ["10.40.20.0/24", "10.40.21.0/24", "10.40.22.0/24"]

  create_database_subnet_group = true
  enable_nat_gateway           = true
  single_nat_gateway           = !local.prod
  enable_dns_hostnames         = true
  enable_flow_log              = local.prod
}

# Only Cloudflare reaches the load balancer (WAF, bot management and rate limits run at the edge).
data "cloudflare_ip_ranges" "cf" {}

resource "aws_security_group" "alb" {
  name   = "${local.name}-alb"
  vpc_id = module.vpc.vpc_id
  ingress {
    description = "HTTPS from Cloudflare only"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = data.cloudflare_ip_ranges.cf.ipv4_cidrs
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "tasks" {
  name   = "${local.name}-tasks"
  vpc_id = module.vpc.vpc_id
  ingress {
    description     = "App ports from the load balancer"
    from_port       = 3000
    to_port         = 4000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "data" {
  name   = "${local.name}-data"
  vpc_id = module.vpc.vpc_id
  ingress {
    description     = "Postgres from tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.tasks.id]
  }
  ingress {
    description     = "Redis from tasks"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.tasks.id]
  }
}
