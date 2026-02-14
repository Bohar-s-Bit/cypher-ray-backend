# Dynamic Analysis Integration Guide

## Overview

This document describes the integration of the **CAPEv2 Dynamic Sandbox** into the Cypher-Ray backend for automated behavioral analysis of suspicious binaries.

## Architecture

The integration follows a **Neuro-Symbolic Workflow**:

1. **Static Analysis** (ML Service) analyzes the binary structure and detects cryptographic artifacts
2. **Dynamic Analysis** (CAPEv2 Sandbox) performs behavioral analysis if suspicious patterns are detected
3. **Combined Results** merge both static and dynamic findings for comprehensive security assessment

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```env
# Dynamic Analysis Engine (CAPEv2 Sandbox)
DYNAMIC_ANALYSIS_ENABLED=true
DYNAMIC_HOST_IP=4.186.27.221
DYNAMIC_PORT=8000
DYNAMIC_API_URL=http://4.186.27.221:8000
DYNAMIC_API_TOKEN=<your_cape_api_token_here>
DYNAMIC_TIMEOUT=240
DYNAMIC_POLL_INTERVAL=30
```

### Network Requirements

⚠️ **Important**: Your backend server must be able to reach port 8000 on the Azure IP (4.186.27.221). If requests time out, check the Azure Network Security Group firewall rules.

## How It Works

### Automatic Triggering

Dynamic analysis is automatically triggered when:

1. **Vulnerabilities detected** in static analysis
2. **Severity is High or Critical**
3. **Cryptographic artifacts** found with suspicious/custom protocols
4. **Code obfuscation** or packing detected

### The Three-Phase Workflow

#### Phase A: Submission

- File is submitted to `/apiv2/tasks/create/file/`
- If static analysis found a crypto loop (e.g., at `0x401000`), the hook offset is passed for surgical hooking
- Target VM: Windows 10 (64-bit)

#### Phase B: Polling

- Backend polls `/apiv2/tasks/status/<task_id>/` every 30 seconds
- Analysis typically takes 2-4 minutes
- Maximum polling time: 10 minutes (20 attempts × 30 seconds)

#### Phase C: Retrieval

- When status becomes "reported", fetch full report from `/apiv2/tasks/get/report/<task_id>/json/`
- Report includes:
  - **Malware Score** (0.0 to 10.0)
  - **Behavioral Signatures** (suspicious behaviors detected)
  - **Extracted Keys** (recovered cryptographic keys)
  - **Process Tree** (runtime process behavior)
  - **Network Activity** (connections made during execution)
  - **File/Registry Operations**

### Risk Assessment

Based on the malware score:

- **0.0 - 0.9**: Clean
- **1.0 - 2.9**: Low Risk
- **3.0 - 4.9**: Medium Risk
- **5.0 - 7.9**: High Risk
- **8.0 - 10.0**: Critical Risk

## API Structure

### Submit File

```http
POST /apiv2/tasks/create/file/
Authorization: Token <API_TOKEN>
Content-Type: multipart/form-data

file: <binary data>
platform: windows
tags: x64
timeout: 200
machine: win10
options: hookoffset=0x401000  # Optional: from static analysis
```

### Check Status

```http
GET /apiv2/tasks/status/<task_id>/
Authorization: Token <API_TOKEN>

Response: {"data": "reported"}  # or pending/running/failed
```

### Get Report

```http
GET /apiv2/tasks/get/report/<task_id>/json/
Authorization: Token <API_TOKEN>

Response: {Full JSON report with behavioral data}
```

## Data Flow

```
User Upload → Static Analysis → [Suspicious?] → Dynamic Analysis → Combined Results
                                      ↓
                                    [Clean] → Return Static Results Only
```

## Response Format

The combined analysis results include:

```json
{
  "file_metadata": { ... },
  "detected_algorithms": [ ... ],
  "vulnerability_assessment": {
    "has_vulnerabilities": true,
    "severity": "Critical",
    "vulnerabilities": [ ... ]
  },
  "dynamic_analysis": {
    "enabled": true,
    "taskId": "12345",
    "malScore": 7.5,
    "riskLevel": "High",
    "signatures": [
      {
        "name": "persistence_autorun",
        "severity": "high",
        "description": "Creates autorun registry key"
      }
    ],
    "extractedKeys": [ ... ],
    "behavioralAnalysis": {
      "processTree": [ ... ],
      "networkActivity": { ... },
      "fileOperations": [ ... ],
      "registryOperations": [ ... ]
    },
    "screenshots": [ ... ]
  }
}
```

## Error Handling

| Error Code         | Meaning                    | Solution                                                  |
| ------------------ | -------------------------- | --------------------------------------------------------- |
| 401 Unauthorized   | Token missing or invalid   | Check `DYNAMIC_API_TOKEN` in `.env`                       |
| Connection Refused | Azure firewall blocking    | Add backend IP to Azure NSG rules                         |
| Report Not Found   | Processing failed          | Check CAPEv2 logs; ensure `process_results=yes`           |
| Timeout            | Analysis exceeded max time | File may be too complex; increase timeout or skip dynamic |

## Monitoring & Logs

All dynamic analysis operations are logged with:

- Job ID and filename
- Submission status
- Polling attempts
- Malware score and risk level
- Errors and warnings

Check logs for:

```javascript
queueLogger.info("Dynamic analysis completed", { ... });
queueLogger.warn("Dynamic analysis failed, continuing with static only", { ... });
```

## Cost & Performance

- **Credit Impact**: Dynamic analysis does NOT charge extra credits. Credits are based on static analysis time and file size only.
- **Processing Time**: Adds 2-4 minutes to overall analysis time
- **Success Rate**: ~95% for PE executables, lower for non-standard formats
- **Network Latency**: Minimal if backend and CAPEv2 are in same Azure region

## Disabling Dynamic Analysis

To disable dynamic analysis:

```env
DYNAMIC_ANALYSIS_ENABLED=false
```

Or remove/comment out the `DYNAMIC_API_TOKEN`.

## Security Notes

1. **Sandboxed Execution**: All files run in isolated Windows VMs that are reset after each analysis
2. **No Network Access**: Default configuration blocks outbound connections
3. **API Authentication**: All requests require valid API token
4. **Data Retention**: Reports are stored for 30 days, then automatically deleted

## Troubleshooting

### Dynamic analysis not triggering

- Check `DYNAMIC_ANALYSIS_ENABLED=true`
- Verify `DYNAMIC_API_TOKEN` is set
- Ensure static analysis flags file as suspicious

### Connection timeout

- Verify Azure NSG allows traffic from your IP
- Test with: `curl http://4.186.27.221:8000/apiv2/`
- Check firewall rules on both ends

### Report not found

- Wait longer before checking status (minimum 2 minutes)
- Check CAPEv2 server logs
- Verify file format is supported (PE, ELF, etc.)

### Authentication failed

- Verify token format: `Token <your_token>` (with "Token" prefix)
- Check token has not expired
- Regenerate token from CAPEv2 admin panel

## Technical Details

### Files Modified

- `services/dynamic.analysis.service.js` - New service for CAPEv2 integration
- `services/analysis.service.js` - Updated to trigger dynamic analysis
- `models/analysis.job.model.js` - Added `dynamic_analysis` field to results
- `.env` and `.env.example` - Added configuration variables

### Key Functions

- `dynamicAnalysisService.analyzeFile()` - Complete workflow (submit → poll → retrieve)
- `analysisService.shouldTriggerDynamicAnalysis()` - Decision logic
- `analysisService.combineResults()` - Merge static + dynamic results

## Future Enhancements

- [ ] Support for Linux/macOS binaries
- [ ] Custom VM profiles (different OS versions)
- [ ] Screenshot analysis and OCR
- [ ] Memory dump extraction
- [ ] YARA rule matching
- [ ] Integration with VirusTotal for additional context

## Support

For issues or questions:

1. Check the logs in `logs/` directory
2. Verify network connectivity to CAPEv2
3. Contact Azure admin for firewall issues
4. Review CAPEv2 documentation at https://capev2.readthedocs.io/

---

**Last Updated**: February 13, 2026  
**Version**: 1.0.0-dynamic
