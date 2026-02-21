terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ---------------------------------------------------------------------------
# DynamoDB Table
# ---------------------------------------------------------------------------
# The physical table name follows the project convention: <BaseName>-<env>
# (e.g., MembersTable-dev). The env suffix prevents name collisions when the
# same module is instantiated in multiple environments inside the same AWS
# account.
resource "aws_dynamodb_table" "this" {
  name         = "${var.table_name}-${var.env}"
  billing_mode = var.billing_mode
  hash_key     = var.hash_key
  range_key    = var.range_key

  # Attribute definitions — only key attributes (table + GSI keys) are declared.
  dynamic "attribute" {
    for_each = var.attributes
    content {
      name = attribute.value.name
      type = attribute.value.type
    }
  }

  # Global Secondary Indexes — each entry becomes one GSI block.
  dynamic "global_secondary_index" {
    for_each = var.global_secondary_indexes
    content {
      name            = global_secondary_index.value.name
      hash_key        = global_secondary_index.value.hash_key
      projection_type = global_secondary_index.value.projection_type
    }
  }

  # Server-side encryption with AWS-owned KMS key (no extra cost).
  server_side_encryption {
    enabled = true
  }

  # Point-in-time recovery: controlled by the caller via enable_pitr.
  # Keep false for dev/staging to stay within Free Tier limits; set true for production.
  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  tags = var.tags

  # Allow terraform destroy in dev/staging without manual table deletion.
  lifecycle {
    prevent_destroy = false
  }
}
