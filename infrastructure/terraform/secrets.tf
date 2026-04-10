# ─── AWS Secrets Manager entries ─────────────────────────────────────────────
# These hold the actual secret values. Fill them after `terraform apply`
# with: aws secretsmanager put-secret-value --secret-id <arn> --secret-string '<json>'

resource "aws_secretsmanager_secret" "backend" {
  name                    = "${local.prefix}/backend"
  description             = "CloudBox backend runtime secrets"
  recovery_window_in_days = 7

  tags = { Name = "${local.prefix}/backend" }
}

# Placeholder version — replace values via AWS Console or CLI before deploying pods
resource "aws_secretsmanager_secret_version" "backend" {
  secret_id = aws_secretsmanager_secret.backend.id

  secret_string = jsonencode({
    DATABASE_URL        = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.main.endpoint}/${var.db_name}"
    REDIS_URL           = "redis://${aws_elasticache_cluster.main.cache_nodes[0].address}:6379"
    JWT_SECRET          = "REPLACE_WITH_$(openssl rand -hex 32)"
    JWT_REFRESH_SECRET  = "REPLACE_WITH_$(openssl rand -hex 32)"
    KAFKA_BROKERS       = "kafka-0.kafka-headless.cloudbox.svc.cluster.local:9092,kafka-1.kafka-headless.cloudbox.svc.cluster.local:9092,kafka-2.kafka-headless.cloudbox.svc.cluster.local:9092"
    S3_BUCKET           = aws_s3_bucket.files.bucket
    AWS_REGION          = var.aws_region
  })

  lifecycle {
    # Prevent Terraform from overwriting secrets after initial creation
    ignore_changes = [secret_string]
  }
}

# ─── IAM Role for External Secrets Operator (IRSA) ───────────────────────────
resource "aws_iam_role" "external_secrets" {
  name = "${local.prefix}-external-secrets-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.eks.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${local.oidc_provider_url}:sub" = "system:serviceaccount:external-secrets:external-secrets"
          "${local.oidc_provider_url}:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })
}

resource "aws_iam_policy" "external_secrets" {
  name        = "${local.prefix}-external-secrets-policy"
  description = "Allow External Secrets Operator to read from Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
          "secretsmanager:ListSecretVersionIds"
        ]
        Resource = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:${local.prefix}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:ListSecrets"]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "external_secrets" {
  role       = aws_iam_role.external_secrets.name
  policy_arn = aws_iam_policy.external_secrets.arn
}

# ─── Helm: External Secrets Operator ─────────────────────────────────────────
resource "helm_release" "external_secrets" {
  name             = "external-secrets"
  repository       = "https://charts.external-secrets.io"
  chart            = "external-secrets"
  version          = "0.9.17"
  namespace        = "external-secrets"
  create_namespace = true

  values = [yamlencode({
    serviceAccount = {
      annotations = {
        "eks.amazonaws.com/role-arn" = aws_iam_role.external_secrets.arn
      }
    }
    # Sync every 1 hour; ESO will also sync on pod restart
    global = {
      affinity = {}
    }
  })]

  depends_on = [aws_eks_node_group.main, aws_iam_role_policy_attachment.external_secrets]
}

# ─── Output the secret ARN (used in ExternalSecret manifest) ─────────────────
output "backend_secret_arn" {
  description = "AWS Secrets Manager ARN for backend secrets"
  value       = aws_secretsmanager_secret.backend.arn
}
