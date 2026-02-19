import httpx
import time
import sys
import json
import os

API_URL = "http://localhost:8000/api"

# Default local path (which had issues), but users can provide a URL
DEFAULT_REPO_PATH = "C:/Users/iampr/OneDrive/Desktop/rift/test_repo"

def run_smoke_test(repo_url=None):
    if not repo_url:
        repo_url = DEFAULT_REPO_PATH
        # Check if local path exists and warn
        if os.path.exists(repo_url) and not repo_url.startswith("http") and not repo_url.startswith("file://"):
             # Convert to file URI for better compatibility if passing local path
             repo_url = f"file:///{repo_url.replace(os.sep, '/')}"

    print(f"--- RIFT Agent Smoke Test ---")
    print(f"Target Repository: {repo_url}")
    
    try:
        with httpx.Client(timeout=30) as client:
            # 1. Trigger run
            print(f"Step 1: Triggering agent run...")
            try:
                resp = client.post(f"{API_URL}/run-agent", json={
                    "repo_url": repo_url,
                    "team_name": "SmokeTest",
                    "leader_name": "Tester"
                })
                resp.raise_for_status()
                run_id = resp.json()["run_id"]
                print(f"SUCCESS: Run started with ID: {run_id}")
            except httpx.ConnectError:
                print("ERROR: Could not connect to backend. Is uvicorn running?")
                print("Try: python -m uvicorn main:app --port 8000")
                sys.exit(1)
            except Exception as e:
                print(f"ERROR: Failed to trigger run: {e}")
                sys.exit(1)

            # 2. Poll status
            print(f"Step 2: Polling status for run {run_id}...")
            status = "running"
            start_time = time.time()
            
            # Poll for up to 5 minutes
            for i in range(150): 
                try:
                    resp = client.get(f"{API_URL}/status/{run_id}")
                    if resp.status_code != 200:
                        print(f"  Polling error: Status {resp.status_code}")
                        continue
                        
                    state = resp.json()
                    status = state.get("status", "unknown")
                    progress = state.get("progress", 0)
                    step = state.get("current_step", "")
                    
                    # Print regular updates
                    if i % 5 == 0 or status in ("complete", "error"):
                        elapsed = int(time.time() - start_time)
                        print(f"  [{elapsed}s] Status: {status.upper()} ({progress}%) - {step}")
                    
                    if status == "error":
                        print(f"\nRUN FAILED with error: {state.get('error')}")
                        print(f"Error Detail: {state.get('error_detail')}")
                        break
                    
                    if status == "complete":
                        print(f"\nRUN COMPLETED successfully.")
                        break
                except Exception as e:
                    print(f"  Polling exception: {e}")
                time.sleep(2)
            
            if status not in ("complete", "error"):
                print("TIMEOUT: Run took too long.")
                sys.exit(1)

            # 3. Get results
            print(f"Step 3: Fetching results...")
            try:
                resp = client.get(f"{API_URL}/results/{run_id}")
                if resp.status_code == 404:
                    print("ERROR: Results not found (404). Run likely crashed without producing results.")
                    sys.exit(1)
                    
                results = resp.json()
                failures = results.get("failures", [])
                fixes = results.get("fixes", [])
                
                print(f"\n--- Verification Report ---")
                print(f"Total Failures Found: {len(failures)}")
                print(f"Total Fixes Proposed: {len(fixes)}")
                
                bug_types = set(f.get("bug_type") for f in failures + fixes)
                print(f"Detected Bug Types: {bug_types}")
                
                print("\nDetailed Failures:")
                if failures:
                    print(json.dumps(failures, indent=2))
                else:
                    print("(No failures recorded)")

                print("\nDetailed Fixes:")
                if fixes:
                    print(json.dumps(fixes, indent=2))
                else:
                    print("(No fixes proposed)")

            except Exception as e:
                 print(f"Failed to get results: {e}")
                 sys.exit(1)

    except KeyboardInterrupt:
        print("\nAborted by user.")
        sys.exit(0)

if __name__ == "__main__":
    # Accept repo URL as argument
    url = sys.argv[1] if len(sys.argv) > 1 else None
    run_smoke_test(url)
