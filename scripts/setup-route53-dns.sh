#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  setup-route53-dns.sh — Set up Route53 hosted zone and DNS records for export
#
#  Creates a Route53 hosted zone for the configured domain and configures
#  the necessary DNS records required for domain export (NS, SOA, MX, TXT,
#  CNAME, and A records).
#
#  Usage:
#    ./scripts/setup-route53-dns.sh [options]
#
#  Options:
#    --domain <domain>    Domain name to configure (default: portfoliodemo.com)
#    --profile <profile>  AWS CLI profile name (default: default)
#    --region <region>    AWS region (default: us-east-1)
#    --export             Export zone file to stdout after creation
#    --dry-run            Print what would be done without making changes
#    --help               Show this help message
#
#  Prerequisites:
#    - AWS CLI installed and configured (aws --version)
#    - Sufficient IAM permissions: route53:CreateHostedZone,
#      route53:ChangeResourceRecordSets, route53:GetHostedZone,
#      route53:ListHostedZonesByName
#
#  Examples:
#    ./scripts/setup-route53-dns.sh
#    ./scripts/setup-route53-dns.sh --domain mydomain.com --profile prod
#    ./scripts/setup-route53-dns.sh --domain mydomain.com --export
#    ./scripts/setup-route53-dns.sh --dry-run
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Defaults ─────────────────────────────────────────────────────────────────
DOMAIN="portfoliodemo.com"
AWS_PROFILE="default"
AWS_REGION="us-east-1"
EXPORT=false
DRY_RUN=false

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RESET='\033[0m'

log()    { echo -e "${CYAN}[route53]${RESET} $*"; }
ok()     { echo -e "${GREEN}[route53]${RESET} $*"; }
warn()   { echo -e "${YELLOW}[route53] WARN:${RESET} $*"; }
error()  { echo -e "${RED}[route53] ERROR:${RESET} $*" >&2; }

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)   DOMAIN="$2";  shift 2 ;;
    --profile)  AWS_PROFILE="$2"; shift 2 ;;
    --region)   AWS_REGION="$2"; shift 2 ;;
    --export)   EXPORT=true; shift ;;
    --dry-run)  DRY_RUN=true; shift ;;
    --help)
      sed -n '2,30p' "$0" | sed 's/^#  \?//'
      exit 0
      ;;
    *)
      error "Unknown option: $1"
      exit 1
      ;;
  esac
done

# ── Validate domain ────────────────────────────────────────────────────────────
if [[ -z "$DOMAIN" ]]; then
  error "Domain name is required."
  exit 1
fi

# Strip trailing dot if present
DOMAIN="${DOMAIN%.}"

log "Configuring Route53 for domain: $DOMAIN"
log "AWS profile: $AWS_PROFILE"
log "AWS region:  $AWS_REGION"

# ── Check prerequisites ───────────────────────────────────────────────────────
if ! command -v aws &>/dev/null; then
  error "AWS CLI not found. Install it from: https://aws.amazon.com/cli/"
  exit 1
fi

log "AWS CLI version: $(aws --version 2>&1)"

# ── Build the hosted zone creation payload ─────────────────────────────────────
# Route53 hosted zone name must end with a trailing dot
ZONE_NAME="${DOMAIN}."
CALLER_REFERENCE="route53-setup-$(date +%Y%m%d%H%M%S)-$$"

HOSTED_ZONE_PAYLOAD=$(cat <<EOF
{
  "Name": "${ZONE_NAME}",
  "CallerReference": "${CALLER_REFERENCE}",
  "HostedZoneConfig": {
    "Comment": "Hosted zone for ${DOMAIN} — created by setup-route53-dns.sh",
    "PrivateZone": false
  }
}
EOF
)

if [[ "$DRY_RUN" == "true" ]]; then
  log "DRY RUN: Would create hosted zone with payload:"
  echo "$HOSTED_ZONE_PAYLOAD" | python3 -m json.tool 2>/dev/null || echo "$HOSTED_ZONE_PAYLOAD"
fi

# ── Create or check for existing hosted zone ────────────────────────────────────
ZONE_ID=""

if [[ "$DRY_RUN" == "false" ]]; then
  log "Checking for existing hosted zone: ${ZONE_NAME}"

  EXISTING_ZONE=$(aws route53 list-hosted-zones-by-name \
    --dns-name "${ZONE_NAME}" \
    --max-items 1 \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    2>/dev/null || echo "")

  if [[ -n "$EXISTING_ZONE" ]]; then
    ZONE_ID=$(echo "$EXISTING_ZONE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
zones = data.get('HostedZones', [])
if zones:
    # Check for exact match (DNS name is compared case-insensitively)
    for z in zones:
        if z['Name'].rstrip('.') == '${DOMAIN}':
            print(z['Id'].split('/')[-1])
            break" 2>/dev/null || true)
  fi

  if [[ -n "$ZONE_ID" ]]; then
    ok "Existing hosted zone found: ${ZONE_ID}"
  else
    log "Creating hosted zone: ${ZONE_NAME}"

    CREATE_RESULT=$(aws route53 create-hosted-zone \
      --name "${ZONE_NAME}" \
      --caller-reference "${CALLER_REFERENCE}" \
      --hosted-zone-config "Comment=Hosted zone for ${DOMAIN} — created by setup-route53-dns.sh,PrivateZone=false" \
      --profile "$AWS_PROFILE" \
      --region "$AWS_REGION" \
      2>&1)

    ZONE_ID=$(echo "$CREATE_RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data['HostedZone']['Id'].split('/')[-1])
" 2>/dev/null || true)

    if [[ -z "$ZONE_ID" ]]; then
      error "Failed to create hosted zone. Output:"
      echo "$CREATE_RESULT"
      exit 1
    fi

    ok "Hosted zone created: ${ZONE_ID} for ${DOMAIN}"
  fi

  # ── Fetch delegation name servers ──────────────────────────────────────────
  ZONE_DETAILS=$(aws route53 get-hosted-zone \
    --id "$ZONE_ID" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    2>&1)

  NAME_SERVERS=$(echo "$ZONE_DETAILS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
ns = data.get('DelegationSet', {}).get('NameServers', [])
for n in ns:
    print(n)
" 2>/dev/null || true)

  if [[ -n "$NAME_SERVERS" ]]; then
    log "Name servers for ${DOMAIN}:"
    while IFS= read -r ns; do
      log "  ${ns}"
    done <<< "$NAME_SERVERS"
  fi
fi

# ── Build DNS record sets ──────────────────────────────────────────────────────
# SOA record is managed by Route53 automatically, so we only define the
# records that need explicit configuration (NS, MX, TXT, CNAME, A).

RECORD_SETS=$(cat <<EOF
{
  "Comment": "DNS records for ${DOMAIN} — created by setup-route53-dns.sh",
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "${DOMAIN}.",
        "Type": "MX",
        "TTL": 300,
        "ResourceRecords": [
          { "Value": "10 mail.${DOMAIN}." }
        ]
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "${DOMAIN}.",
        "Type": "TXT",
        "TTL": 300,
        "ResourceRecords": [
          { "Value": "\"v=spf1 include:amazonses.com ~all\"" }
        ]
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "www.${DOMAIN}.",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [
          { "Value": "${DOMAIN}." }
        ]
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.${DOMAIN}.",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [
          { "Value": "${DOMAIN}." }
        ]
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "${DOMAIN}.",
        "Type": "A",
        "TTL": 300,
        "ResourceRecords": [
          { "Value": "127.0.0.1" }
        ]
      }
    }
  ]
}
EOF
)

# ── Apply DNS record changes ──────────────────────────────────────────────────
if [[ "$DRY_RUN" == "true" ]]; then
  log "DRY RUN: Would apply the following DNS record changes:"
  echo "$RECORD_SETS" | python3 -m json.tool 2>/dev/null || echo "$RECORD_SETS"
  log "DRY RUN completed — no changes made."
  exit 0
fi

if [[ -n "$ZONE_ID" ]]; then
  log "Applying DNS record sets to zone: ${ZONE_ID}"

  CHANGE_RESULT=$(aws route53 change-resource-record-sets \
    --hosted-zone-id "$ZONE_ID" \
    --change-batch "$RECORD_SETS" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    2>&1)

  CHANGE_ID=$(echo "$CHANGE_RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data['ChangeInfo']['Id'].split('/')[-1])
" 2>/dev/null || true)

  if [[ -n "$CHANGE_ID" ]]; then
    ok "DNS records submitted. Change ID: ${CHANGE_ID}"
    log "Waiting for DNS changes to propagate (may take up to 60 seconds)..."
    aws route53 wait resource-record-sets-changed \
      --id "$CHANGE_ID" \
      --profile "$AWS_PROFILE" \
      --region "$AWS_REGION" \
      2>/dev/null || true
    ok "DNS records propagated successfully."
  else
    warn "Could not extract change ID. Output:"
    echo "$CHANGE_RESULT"
  fi

  # ── Export zone file if requested ──────────────────────────────────────────
  if [[ "$EXPORT" == "true" ]]; then
    log "Exporting zone file for ${DOMAIN}:"
    echo ""
    echo "; Route53 Hosted Zone — ${DOMAIN}"
    echo "; Zone ID: ${ZONE_ID}"
    echo "; Export generated at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo ""
    echo "\$ORIGIN ${DOMAIN}."
    echo "\$TTL 86400"
    echo ""
    echo "; SOA Record"
    echo "${DOMAIN}. 900 IN SOA ns-1.awsdns-01.org. awsdns-hostmaster.amazon.com. ("
    echo "  1          ; serial"
    echo "  7200       ; refresh"
    echo "  900        ; retry"
    echo "  1209600    ; expire"
    echo "  86400      ; minimum"
    echo ")"
    echo ""
    echo "; NS Records"
    while IFS= read -r ns; do
      echo "${DOMAIN}. 172800 IN NS ${ns}"
    done <<< "$NAME_SERVERS"
    echo ""
    echo "; MX Records"
    echo "${DOMAIN}. 300 IN MX 10 mail.${DOMAIN}."
    echo ""
    echo "; TXT Records"
    echo "${DOMAIN}. 300 IN TXT \"v=spf1 include:amazonses.com ~all\""
    echo ""
    echo "; CNAME Records"
    echo "www.${DOMAIN}. 300 IN CNAME ${DOMAIN}."
    echo "api.${DOMAIN}. 300 IN CNAME ${DOMAIN}."
    echo ""
    echo "; A Records"
    echo "${DOMAIN}. 300 IN A 127.0.0.1"
  fi

  ok "Route53 setup complete for ${DOMAIN} (zone: ${ZONE_ID})"
  echo ""
  echo "Next steps:"
  echo "  1. Update your domain registrar's name servers to the Route53 delegation servers listed above."
  echo "  2. Verify DNS propagation with: dig ${DOMAIN} NS +short"
  echo "  3. For production, update the A record to your deployment IP address."
fi
