# ─── Subnet Group ─────────────────────────────────────────────────────────────
resource "aws_db_subnet_group" "main" {
  name       = "${local.prefix}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "${local.prefix}-db-subnet-group" }
}

# ─── Parameter Group ──────────────────────────────────────────────────────────
resource "aws_db_parameter_group" "postgres" {
  name   = "${local.prefix}-postgres15"
  family = "postgres15"

  parameter {
    name  = "log_connections"
    value = "1"
  }
  parameter {
    name  = "log_disconnections"
    value = "1"
  }
  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # log queries > 1s
  }

  tags = { Name = "${local.prefix}-postgres15" }
}

# ─── RDS Instance ─────────────────────────────────────────────────────────────
resource "aws_db_instance" "main" {
  identifier = "${local.prefix}-postgres"

  engine               = "postgres"
  engine_version       = "15.6"
  instance_class       = var.db_instance_class
  allocated_storage    = 20
  max_allocated_storage = 100   # auto-scaling up to 100 GB
  storage_type         = "gp3"
  storage_encrypted    = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.postgres.name

  multi_az               = var.db_multi_az
  publicly_accessible    = false
  skip_final_snapshot    = false
  final_snapshot_identifier = "${local.prefix}-postgres-final"
  deletion_protection    = true
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"

  performance_insights_enabled = true
  monitoring_interval          = 60
  monitoring_role_arn          = aws_iam_role.rds_monitoring.arn

  tags = { Name = "${local.prefix}-postgres" }
}

# ─── Enhanced Monitoring Role ─────────────────────────────────────────────────
resource "aws_iam_role" "rds_monitoring" {
  name = "${local.prefix}-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}
