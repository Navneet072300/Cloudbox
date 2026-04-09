# ─── Subnet Group ─────────────────────────────────────────────────────────────
resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.prefix}-redis-subnet-group"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "${local.prefix}-redis-subnet-group" }
}

# ─── Parameter Group ──────────────────────────────────────────────────────────
resource "aws_elasticache_parameter_group" "redis" {
  name   = "${local.prefix}-redis7"
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  tags = { Name = "${local.prefix}-redis7" }
}

# ─── ElastiCache Cluster ──────────────────────────────────────────────────────
resource "aws_elasticache_cluster" "main" {
  cluster_id           = "${local.prefix}-redis"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  num_cache_nodes      = var.redis_num_cache_nodes
  parameter_group_name = aws_elasticache_parameter_group.redis.name
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]
  port                 = 6379

  snapshot_retention_limit = 1
  snapshot_window          = "05:00-06:00"

  tags = { Name = "${local.prefix}-redis" }
}
