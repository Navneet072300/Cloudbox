# ─── metrics-server ───────────────────────────────────────────────────────────
resource "helm_release" "metrics_server" {
  name       = "metrics-server"
  repository = "https://kubernetes-sigs.github.io/metrics-server/"
  chart      = "metrics-server"
  version    = "3.12.1"
  namespace  = "kube-system"

  values = [yamlencode({
    args = ["--kubelet-insecure-tls"]
  })]

  depends_on = [aws_eks_node_group.main]
}

# ─── AWS Load Balancer Controller ─────────────────────────────────────────────
resource "helm_release" "alb_controller" {
  name       = "aws-load-balancer-controller"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  version    = "1.7.2"
  namespace  = "kube-system"

  values = [yamlencode({
    clusterName  = local.cluster_name
    region       = var.aws_region
    vpcId        = aws_vpc.main.id
    replicaCount = 2
    serviceAccount = {
      create = true
      name   = "aws-load-balancer-controller"
      annotations = {
        "eks.amazonaws.com/role-arn" = aws_iam_role.alb_controller.arn
      }
    }
  })]

  depends_on = [aws_eks_addon.vpc_cni, aws_iam_role_policy_attachment.alb_controller]
}

# ─── cert-manager ─────────────────────────────────────────────────────────────
resource "helm_release" "cert_manager" {
  name             = "cert-manager"
  repository       = "https://charts.jetstack.io"
  chart            = "cert-manager"
  version          = "v1.14.5"
  namespace        = "cert-manager"
  create_namespace = true

  values = [yamlencode({ installCRDs = true })]

  depends_on = [aws_eks_node_group.main]
}

# ─── External DNS ─────────────────────────────────────────────────────────────
resource "aws_iam_role" "external_dns" {
  name = "${local.prefix}-external-dns-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.eks.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${local.oidc_provider_url}:sub" = "system:serviceaccount:kube-system:external-dns"
          "${local.oidc_provider_url}:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })
}

resource "aws_iam_policy" "external_dns" {
  name = "${local.prefix}-external-dns-policy"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["route53:ChangeResourceRecordSets"]
        Resource = ["arn:aws:route53:::hostedzone/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["route53:ListHostedZones", "route53:ListResourceRecordSets"]
        Resource = ["*"]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "external_dns" {
  role       = aws_iam_role.external_dns.name
  policy_arn = aws_iam_policy.external_dns.arn
}

resource "helm_release" "external_dns" {
  name       = "external-dns"
  repository = "https://kubernetes-sigs.github.io/external-dns/"
  chart      = "external-dns"
  version    = "1.14.4"
  namespace  = "kube-system"

  values = [yamlencode({
    provider     = "aws"
    domainFilters = [var.domain_name]
    policy       = "sync"
    aws = {
      region = var.aws_region
    }
    serviceAccount = {
      annotations = {
        "eks.amazonaws.com/role-arn" = aws_iam_role.external_dns.arn
      }
    }
  })]

  depends_on = [helm_release.alb_controller]
}

# ─── Cluster Autoscaler ───────────────────────────────────────────────────────
resource "aws_iam_role" "cluster_autoscaler" {
  name = "${local.prefix}-cluster-autoscaler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.eks.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${local.oidc_provider_url}:sub" = "system:serviceaccount:kube-system:cluster-autoscaler"
          "${local.oidc_provider_url}:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })
}

resource "aws_iam_policy" "cluster_autoscaler" {
  name = "${local.prefix}-cluster-autoscaler-policy"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "autoscaling:DescribeAutoScalingGroups",
        "autoscaling:DescribeAutoScalingInstances",
        "autoscaling:DescribeLaunchConfigurations",
        "autoscaling:DescribeScalingActivities",
        "autoscaling:DescribeTags",
        "autoscaling:SetDesiredCapacity",
        "autoscaling:TerminateInstanceInAutoScalingGroup",
        "ec2:DescribeImages",
        "ec2:DescribeInstanceTypes",
        "ec2:DescribeLaunchTemplateVersions",
        "ec2:GetInstanceTypesFromInstanceRequirements",
        "eks:DescribeNodegroup"
      ]
      Resource = ["*"]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "cluster_autoscaler" {
  role       = aws_iam_role.cluster_autoscaler.name
  policy_arn = aws_iam_policy.cluster_autoscaler.arn
}

resource "helm_release" "cluster_autoscaler" {
  name       = "cluster-autoscaler"
  repository = "https://kubernetes.github.io/autoscaler"
  chart      = "cluster-autoscaler"
  version    = "9.36.0"
  namespace  = "kube-system"

  values = [yamlencode({
    autoDiscovery = {
      clusterName = local.cluster_name
    }
    awsRegion = var.aws_region
    extraArgs = {
      "balance-similar-node-groups" = true
      "skip-nodes-with-system-pods" = false
    }
    rbac = {
      serviceAccount = {
        annotations = {
          "eks.amazonaws.com/role-arn" = aws_iam_role.cluster_autoscaler.arn
        }
      }
    }
  })]

  depends_on = [aws_eks_node_group.main]
}

# ─── kube-prometheus-stack (Prometheus + Grafana + Alertmanager) ──────────────
resource "helm_release" "kube_prometheus" {
  name             = "kube-prometheus-stack"
  repository       = "https://prometheus-community.github.io/helm-charts"
  chart            = "kube-prometheus-stack"
  version          = "58.3.1"
  namespace        = "monitoring"
  create_namespace = true

  values = [yamlencode({
    grafana = {
      adminPassword = "change-me-in-prod"
      ingress = {
        enabled = false
      }
    }
    prometheus = {
      prometheusSpec = {
        retention = "15d"
        storageSpec = {
          volumeClaimTemplate = {
            spec = {
              storageClassName = "gp2"
              resources = {
                requests = { storage = "20Gi" }
              }
            }
          }
        }
      }
    }
  })]

  depends_on = [aws_eks_addon.ebs_csi]
}
