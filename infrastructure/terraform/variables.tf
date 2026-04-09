# ─── General ──────────────────────────────────────────────────────────────────
variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev | staging | prod)"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod"
  }
}

variable "project" {
  description = "Project name — used as a prefix for all resources"
  type        = string
  default     = "cloudbox"
}

# ─── Networking ───────────────────────────────────────────────────────────────
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "AZs to spread resources across (min 2)"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

# ─── EKS ──────────────────────────────────────────────────────────────────────
variable "cluster_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.30"
}

variable "node_instance_type" {
  description = "EC2 instance type for EKS managed node group"
  type        = string
  default     = "t3.medium"
}

variable "node_min_size" {
  description = "Minimum number of nodes"
  type        = number
  default     = 2
}

variable "node_max_size" {
  description = "Maximum number of nodes"
  type        = number
  default     = 6
}

variable "node_desired_size" {
  description = "Desired number of nodes"
  type        = number
  default     = 3
}

# ─── RDS ──────────────────────────────────────────────────────────────────────
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "cloudbox"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "cloudbox"
}

variable "db_password" {
  description = "PostgreSQL master password (store in Secrets Manager, not here)"
  type        = string
  sensitive   = true
}

variable "db_multi_az" {
  description = "Enable RDS Multi-AZ for high availability"
  type        = bool
  default     = true
}

# ─── ElastiCache ──────────────────────────────────────────────────────────────
variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_cache_nodes" {
  description = "Number of Redis cache nodes"
  type        = number
  default     = 1
}

# ─── S3 ───────────────────────────────────────────────────────────────────────
variable "s3_bucket_name" {
  description = "S3 bucket name for file storage (must be globally unique)"
  type        = string
  default     = "cloudbox-files"
}

# ─── DNS / TLS ────────────────────────────────────────────────────────────────
variable "domain_name" {
  description = "Root domain name (e.g. cloudbox.example.com)"
  type        = string
  default     = "cloudbox.example.com"
}

variable "acm_certificate_arn" {
  description = "ARN of an existing ACM certificate (leave empty to skip HTTPS)"
  type        = string
  default     = ""
}
