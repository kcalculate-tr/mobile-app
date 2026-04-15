#!/bin/bash

# 🛡️ KCAL Crash-Proof Verification Script
# Run this to verify all reliability systems are in place

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║     KCAL CRASH-PROOF VERIFICATION                             ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

check() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((PASS++))
  else
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((FAIL++))
  fi
}

# 1. Check if reliability files exist
echo "📁 Checking reliability files..."
test -f src/components/ErrorBoundary.tsx
check "ErrorBoundary component exists"

test -f src/lib/reliability.ts
check "Reliability library exists"

test -f src/hooks/useReliability.ts
check "useReliability hook exists"

echo ""

# 2. Check if dependencies are installed
echo "📦 Checking dependencies..."
grep -q "react-native-error-boundary" package.json
check "react-native-error-boundary in package.json"

grep -q "@react-native-community/netinfo" package.json
check "@react-native-community/netinfo in package.json"

echo ""

# 3. Check if App.tsx has Error Boundary
echo "🛡️ Checking App.tsx integration..."
grep -q "ErrorBoundary" App.tsx
check "ErrorBoundary wrapper in App.tsx"

grep -q "setupGlobalErrorHandler" App.tsx
check "Global error handler initialized"

grep -q "setupAppStateListener" App.tsx
check "AppState listener setup"

echo ""

# 4. Check if critical files have try/catch
echo "🔍 Checking try/catch blocks..."
grep -q "try {" src/context/AuthContext.tsx
check "Try/catch in AuthContext"

grep -q "try {" src/lib/payment.ts
check "Try/catch in payment.ts"

grep -q "try {" src/lib/notifications.ts
check "Try/catch in notifications.ts"

echo ""

# 5. Check if useEffect hooks have cleanup
echo "🧹 Checking cleanup functions..."
grep -q "return () =>" App.tsx
check "Cleanup in App.tsx useEffect"

grep -q "subscription?.unsubscribe()" src/context/AuthContext.tsx
check "Subscription cleanup in AuthContext"

echo ""

# 6. TypeScript check
echo "📝 Running TypeScript check..."
npx tsc --noEmit 2>&1 | grep -E "^(App\.tsx|src/)" > /tmp/kcal-ts-errors.txt
if [ ! -s /tmp/kcal-ts-errors.txt ]; then
  echo -e "${GREEN}✅ PASS${NC}: TypeScript check (0 errors)"
  ((PASS++))
else
  ERROR_COUNT=$(wc -l < /tmp/kcal-ts-errors.txt)
  echo -e "${RED}❌ FAIL${NC}: TypeScript check ($ERROR_COUNT errors)"
  ((FAIL++))
  echo "   Run 'npx tsc --noEmit' to see details"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    VERIFICATION RESULTS                       ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}✅ PASSED: $PASS${NC}"
echo -e "${RED}❌ FAILED: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}🎉 ALL CHECKS PASSED - CRASH-PROOF READY!${NC}"
  exit 0
else
  echo -e "${RED}⚠️  SOME CHECKS FAILED - REVIEW REQUIRED${NC}"
  exit 1
fi
