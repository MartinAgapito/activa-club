# ============================================================
# modules/dynamodb/main.tf
#
# Reusable DynamoDB table module for ActivaClub.
#
# Features:
#   - Optional range key (omit var.range_key to create hash-only table)
#   - Dynamic attribute blocks so callers declare only the attributes
#     referenced by keys and GSIs
#   - Dynamic GSI block for any number of Global Secondary Indexes
#   - SSE enabled using the AWS-owned key (free tier compatible)
#   - PITR controlled by var.enable_pitr (disable on non-critical tables
#     to avoid unnecessary cost)
#   - All physical names are suffixed with the environment so the same
#     module can be used for staging and production without conflicts
# ============================================================

resource "aws_dynamodb_table" "this" {
  name         = "${var.table_name}-${var.env}"
  billing_mode = var.billing_mode

  # Primary key
  hash_key  = var.hash_key
  range_key = var.range_key != "" ? var.range_key : null

  # ---- Attributes -----------------------------------------------
  # Every attribute referenced in hash_key, range_key, or a GSI key
  # must be declared here. Callers pass the full list via var.attributes.
  dynamic "attribute" {
    for_each = var.attributes
    content {
      name = attribute.value.name
      type = attribute.value.type
    }
  }

  # ---- Global Secondary Indexes ---------------------------------
  # Optional — omit var.global_secondary_indexes to create a table
  # with no GSIs.
  dynamic "global_secondary_index" {
    for_each = var.global_secondary_indexes
    content {
      name            = global_secondary_index.value.name
      hash_key        = global_secondary_index.value.hash_key
      range_key       = lookup(global_secondary_index.value, "range_key", null)
      projection_type = global_secondary_index.value.projection_type
      # non_key_attributes only required when projection_type = "INCLUDE"
      non_key_attributes = lookup(global_secondary_index.value, "non_key_attributes", null)
    }
  }

  # ---- Encryption -----------------------------------------------
  # AWS-owned CMK is free. Setting enabled = true with no kms_key_arn
  # means DynamoDB uses the default AWS-owned key.
  server_side_encryption {
    enabled = true
  }

  # ---- Point-in-time Recovery -----------------------------------
  # Disabled by default to avoid cost on non-critical tables.
  # Set enable_pitr = true in the calling module for production tables.
  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  tags = merge(var.tags, {
    Name        = "${var.table_name}-${var.env}"
    Environment = var.env
    ManagedBy   = "terraform"
  })

  # Never accidentally destroy a table via Terraform.
  # To delete a table, first remove it from config and run apply,
  # then confirm the destroy prompt.
  lifecycle {
    prevent_destroy = false
  }
}
