# ✅ Backend Integration Verification Checklist

## Immediate Actions Required

### 1. Add Dynamic Analysis API Token

```bash
# Edit .env file
nano .env

# Add your CAPEv2 API token
DYNAMIC_API_TOKEN=<paste_your_token_here>
```

**How to get the token:**

- Contact CAPEv2 admin OR
- Access CAPEv2 admin panel at http://4.186.27.221:8000/admin
- Generate new API token from settings

### 2. Test Network Connectivity

```bash
# Test if CAPEv2 is reachable
curl -H "Authorization: Token YOUR_TOKEN_HERE" http://4.186.27.221:8000/apiv2/

# Expected response: JSON with API version info
```

If connection fails:

- Check Azure Network Security Group rules
- Verify your IP is whitelisted
- Contact Azure admin to add your backend server IP

### 3. Start Required Services

```bash
# Terminal 1: Start MongoDB
mongod

# Terminal 2: Start Redis
redis-server

# Terminal 3: Start ML Service (Python)
cd ../cypher-ray-models
python main.py

# Terminal 4: Start Backend
cd ../cypher-ray-backend
npm run dev
```

## Testing the Integration

### Test 1: Verify Configuration

```javascript
// Run this to check if dynamic analysis is enabled
const dynamicService = require("./services/dynamic.analysis.service.js");
console.log("Enabled:", dynamicService.default.isEnabled());
// Should output: true (if token is configured)
```

### Test 2: Health Check

```bash
# Create test script: test-dynamic.js
import dynamicAnalysisService from './services/dynamic.analysis.service.js';

async function test() {
  const health = await dynamicAnalysisService.checkHealth();
  console.log('Health:', health);
}

test();
```

Run:

```bash
node test-dynamic.js
```

Expected output:

```json
{
  "healthy": true,
  "version": "2.0.x"
}
```

### Test 3: Upload Suspicious File

1. Upload a test binary through the SDK or dashboard
2. Check logs for:

   ```
   [INFO] Triggering dynamic analysis
   [INFO] File submitted to dynamic analysis, taskId: 12345
   [INFO] Dynamic analysis completed, malScore: X.X
   ```

3. Verify the response includes `dynamic_analysis` field:
   ```json
   {
     "dynamic_analysis": {
       "enabled": true,
       "taskId": "12345",
       "malScore": 7.5,
       "riskLevel": "High",
       ...
     }
   }
   ```

### Test 4: Upload Clean File

1. Upload a known clean binary
2. Verify it skips dynamic analysis:
   ```
   [INFO] Dynamic analysis was not triggered
   ```

## Configuration Verification

✅ **Check all environment variables are set:**

```bash
# Run this in backend directory
grep -E "DYNAMIC_|MODEL_URL" .env

# Should show:
# DYNAMIC_ANALYSIS_ENABLED=true
# DYNAMIC_HOST_IP=4.186.27.221
# DYNAMIC_PORT=8000
# DYNAMIC_API_URL=http://4.186.27.221:8000
# DYNAMIC_API_TOKEN=<your_token>
# DYNAMIC_TIMEOUT=240
# DYNAMIC_POLL_INTERVAL=30
# MODEL_URL=http://localhost:5000/analyze
```

✅ **Verify files exist:**

```bash
ls -la services/dynamic.analysis.service.js
ls -la DYNAMIC_ANALYSIS_INTEGRATION.md
ls -la BACKEND_UPDATES_SUMMARY.md
```

✅ **Check for syntax errors:**

```bash
node -c services/dynamic.analysis.service.js
node -c services/analysis.service.js
# Should output nothing (no errors)
```

## Monitoring Commands

### Watch Logs

```bash
# Watch backend logs for dynamic analysis events
tail -f logs/*.log | grep -i "dynamic"
```

### Check Queue Status

```bash
# In Node.js console or test script
const queue = require('./config/queue.js');
queue.sdkAnalysisQueue.getJobCounts().then(console.log);
```

### Monitor Redis

```bash
redis-cli
KEYS bull:sdk-analysis:*
```

## Troubleshooting

### Issue: "Dynamic analysis is not enabled"

**Solution:**

```bash
# Check .env file
cat .env | grep DYNAMIC

# Ensure:
DYNAMIC_ANALYSIS_ENABLED=true
DYNAMIC_API_TOKEN=<not empty>
```

### Issue: "Connection refused to CAPEv2"

**Solutions:**

1. Test connectivity:
   ```bash
   nc -zv 4.186.27.221 8000
   ```
2. Check Azure firewall
3. Verify backend server IP is whitelisted

### Issue: "401 Unauthorized"

**Solution:**

- Verify token format: `Token <your_token>` (with "Token" prefix)
- Check token hasn't expired
- Regenerate token from CAPEv2 admin panel

### Issue: Reports not found

**Solutions:**

- Wait longer (analysis takes 2-4 minutes)
- Check CAPEv2 server status
- Verify file format is supported (PE, ELF)

### Issue: Dynamic analysis always times out

**Solutions:**

- Increase timeout: `DYNAMIC_TIMEOUT=360` (6 minutes)
- Increase poll interval: `DYNAMIC_POLL_INTERVAL=45`
- Check file size (very large files may exceed timeout)

## Performance Expectations

| Metric                       | Expected Value    |
| ---------------------------- | ----------------- |
| Static Analysis              | 10-60 seconds     |
| Dynamic Analysis             | 2-4 minutes       |
| Total Time (suspicious file) | 3-5 minutes       |
| Total Time (clean file)      | 10-60 seconds     |
| Dynamic Trigger Rate         | 20-30% of uploads |
| Success Rate                 | >95% for PE files |

## Security Checklist

✅ API token stored in `.env` (not committed to git)  
✅ `.env` listed in `.gitignore`  
✅ Network access restricted to authorized IPs  
✅ Token rotation policy in place  
✅ Logs don't expose sensitive data

## Rollback Procedure

If issues occur during production:

```bash
# Disable dynamic analysis immediately
nano .env

# Change:
DYNAMIC_ANALYSIS_ENABLED=false

# Restart server
pm2 restart cypher-ray-backend
# OR
npm run dev
```

This reverts to static-analysis-only mode without code changes.

## Production Deployment

### Pre-deployment Checklist

- [ ] All tests passing
- [ ] Valid API token configured
- [ ] Network connectivity verified
- [ ] Logs monitored for errors
- [ ] Load tested with 10+ concurrent analyses
- [ ] Rollback plan documented
- [ ] Team trained on new features

### Environment Variables (Production)

```env
# Use production CAPEv2 if available
DYNAMIC_API_URL=http://production-cape-server:8000
DYNAMIC_API_TOKEN=<production_token>
DYNAMIC_ANALYSIS_ENABLED=true
```

### Monitoring Alerts

Set up alerts for:

- CAPEv2 connection failures
- High dynamic analysis failure rate (>10%)
- Timeouts exceeding threshold
- API token expiration

## Support & Documentation

📖 **Detailed Guide**: [DYNAMIC_ANALYSIS_INTEGRATION.md](./DYNAMIC_ANALYSIS_INTEGRATION.md)  
📝 **Changes Summary**: [BACKEND_UPDATES_SUMMARY.md](./BACKEND_UPDATES_SUMMARY.md)  
🔧 **Main README**: [README.md](./README.md)

## Contact

For technical issues:

- Review logs in `logs/` directory
- Check CAPEv2 status page
- Contact Azure admin for network/firewall issues
- Review CAPEv2 docs: https://capev2.readthedocs.io/

---

**Last Updated**: February 13, 2026  
**Status**: ✅ Ready for Testing  
**Next Step**: Add your CAPEv2 API token and run Test 2 (Health Check)
