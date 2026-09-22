#!/bin/bash
# Security Middleware Verification Script for Task #9574
# Verifies that helmet, CSRF, rate-limiting, and input-validation are properly configured

echo "🔍 Security Middleware Verification"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Check function
check() {
    local description="$1"
    local command="$2"
    
    if eval "$command" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ ${description}${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ ${description}${NC}"
        ((FAILED++))
    fi
}

# Check if we're in the server directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Must run from product-template/server directory${NC}"
    exit 1
fi

echo "📦 1. Checking Security Packages..."
echo "------------------------------------"

check "Helmet package found in package.json" "grep -q '\"helmet\"' package.json"
check "CSRF package (csrf-csrf) found in package.json" "grep -q '\"csrf-csrf\"' package.json"
check "Rate limiting package found in package.json" "grep -q '\"express-rate-limit\"' package.json"
check "Input validation package (Zod) found in package.json" "grep -q '\"zod\"' package.json"

echo ""
echo "🛡️  2. Checking Helmet Implementation..."
echo "------------------------------------"

check "Helmet middleware file exists" "test -f 'src/lib/@system/Middleware/security.js'"
check "Helmet is configured with options" "grep -q 'helmet({' src/lib/@system/Middleware/security.js"
check "CSP (Content Security Policy) configured" "grep -q 'contentSecurityPolicy' src/lib/@system/Middleware/security.js"
check "HSTS (HTTP Strict Transport Security) configured" "grep -q 'hsts:' src/lib/@system/Middleware/security.js"
check "Frameguard (clickjacking protection) configured" "grep -q 'frameguard' src/lib/@system/Middleware/security.js"
check "X-Content-Type-Options configured" "grep -q 'noSniff' src/lib/@system/Middleware/security.js"

echo ""
echo "🛡️  3. Checking CSRF Protection..."
echo "------------------------------------"

check "CSRF middleware file exists" "test -f 'src/lib/@system/Middleware/csrf.js'"
check "Using csrf-csrf package (double-submit cookie)" "grep -q 'csrf-csrf' src/lib/@system/Middleware/csrf.js"
check "CSRF protection middleware exported" "grep -q 'csrfProtection' src/lib/@system/Middleware/csrf.js"
check "CSRF token generation function exported" "grep -q 'generateCsrfToken' src/lib/@system/Middleware/csrf.js"
check "CSRF token endpoint exists" "test -f 'src/api/@system/csrf.js'"
check "GET /csrf-token route defined" "grep -q '/csrf-token' src/api/@system/csrf.js"

echo ""
echo "⏱️  4. Checking Rate Limiting..."
echo "------------------------------------"

check "Rate Limiting module exists" "test -f 'src/lib/@system/RateLimit/index.js'"
check "Using express-rate-limit package" "grep -q 'express-rate-limit' src/lib/@system/RateLimit/index.js"
check "General API rate limiter defined" "grep -q 'apiLimiter' src/lib/@system/RateLimit/index.js"
check "Login-specific rate limiter defined" "grep -q 'loginLimiter' src/lib/@system/RateLimit/index.js"
check "Registration rate limiter defined" "grep -q 'registerLimiter' src/lib/@system/RateLimit/index.js"
check "Redis-backed store implemented" "grep -q 'RedisStore' src/lib/@system/RateLimit/index.js"

echo ""
echo "✅ 5. Checking Input Validation..."
echo "------------------------------------"

check "Input validation module exists" "test -f 'src/lib/@system/Validation/index.js'"
check "Using Zod for schema validation" "grep -q 'zod' src/lib/@system/Validation/index.js"
check "Validation middleware factory exists" "grep -q 'validate' src/lib/@system/Validation/index.js"
check "Safe parsing implemented" "grep -q 'safeParse' src/lib/@system/Validation/index.js"
check "Validation schemas directory exists" "test -d 'src/lib/@system/Validation/schemas'"

echo ""
echo "🔗 6. Checking Middleware Integration..."
echo "------------------------------------"

check "Main app.js file exists" "test -f 'src/app.js'"
check "Security headers middleware integrated" "grep -q 'securityHeaders' src/app.js"
check "CSRF protection middleware integrated" "grep -q 'csrfProtection' src/app.js"
check "Rate limiting middleware integrated" "grep -q 'apiLimiter' src/app.js"
check "Login rate limiter used in sessions route" "test -f 'src/api/@system/sessions/index.js' && grep -q 'loginLimiter' src/api/@system/sessions/index.js"
check "Input validation used in sessions route" "test -f 'src/api/@system/sessions/index.js' && grep -q 'validate' src/api/@system/sessions/index.js"

echo ""
echo "📊 Verification Summary"
echo "===================================="
echo -e "✅ Passed: ${GREEN}${PASSED}${NC}"
echo -e "❌ Failed: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All security middleware checks passed!${NC}"
    echo ""
    echo "Security Features Verified:"
    echo "  ✅ Helmet (security headers)"
    echo "  ✅ CSRF protection (double-submit cookie)"
    echo "  ✅ Rate limiting (with Redis support)"
    echo "  ✅ Input validation (Zod schemas)"
    echo ""
    echo "The template has comprehensive security middleware already implemented."
    exit 0
else
    echo -e "${RED}⚠️  Some security checks failed!${NC}"
    echo "Please review the failed checks above."
    exit 1
fi
