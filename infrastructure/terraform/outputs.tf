output "cluster_name" {
  description = "EKS cluster name"
  value       = aws_eks_cluster.main.name
}

output "cluster_endpoint" {
  description = "EKS API server endpoint"
  value       = aws_eks_cluster.main.endpoint
}

output "kubeconfig_command" {
  description = "Run this to configure kubectl"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${aws_eks_cluster.main.name}"
}

output "ecr_backend_url" {
  description = "ECR URL for backend image"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecr_frontend_url" {
  description = "ECR URL for frontend image"
  value       = aws_ecr_repository.frontend.repository_url
}

output "db_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = "${aws_elasticache_cluster.main.cache_nodes[0].address}:6379"
  sensitive   = true
}

output "s3_bucket_name" {
  description = "S3 bucket for file uploads"
  value       = aws_s3_bucket.files.bucket
}

output "backend_irsa_role_arn" {
  description = "Annotate the backend ServiceAccount with this ARN"
  value       = aws_iam_role.backend.arn
}
